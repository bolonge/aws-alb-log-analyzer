from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from app.config import Settings
from app.database import async_session
from app.models import Analysis, AnalysisClientStat, AnalysisPathStat
from app.services.cf_log_parser import parse_cf_line
from app.services.log_parser import parse_line
from app.services.s3_reader import list_cf_log_keys, list_log_keys, read_log_file


async def _update_progress(db, analysis: Analysis, message: str):
    analysis.progress_message = message
    await db.commit()


async def run_analysis(analysis_id: UUID, alarm_time: datetime, s: Settings):
    """Main analysis pipeline. Runs as a background task."""
    async with async_session() as db:
        analysis = await db.get(Analysis, analysis_id)
        if not analysis:
            return

        analysis.status = "running"
        is_cf = analysis.source_type == "cloudfront"
        await _update_progress(db, analysis, "S3 로그 파일 목록을 조회하고 있습니다...")

        try:
            if is_cf:
                keys = list_cf_log_keys(s, analysis.window_start, analysis.window_end)
            else:
                keys = list_log_keys(s, analysis.window_start, analysis.window_end)

            total_keys = len(keys)
            if total_keys == 0:
                await _update_progress(db, analysis, "해당 시간대의 로그 파일이 없습니다.")

            total_requests = 0
            total_4xx = 0
            status_counter: dict[str, int] = defaultdict(int)
            path_counter: dict[str, dict] = defaultdict(
                lambda: {"count": 0, "status_codes": defaultdict(int), "method": "", "path": ""}
            )
            client_counter: dict[str, dict] = defaultdict(
                lambda: {"count": 0, "paths": defaultdict(int), "status_codes": defaultdict(int)}
            )

            for i, key in enumerate(keys, 1):
                await _update_progress(
                    db, analysis,
                    f"로그를 다운받고 있습니다... ({i}/{total_keys})"
                )

                lines = read_log_file(s, key)
                for line in lines:
                    entry = parse_cf_line(line) if is_cf else parse_line(line)
                    if entry is None:
                        continue
                    total_requests += 1

                    status_code = entry.status_code if is_cf else entry.elb_status_code
                    if 400 <= status_code < 500:
                        total_4xx += 1
                        sc = str(status_code)
                        status_counter[sc] += 1

                        path_key = f"{entry.method} {entry.path}"
                        path_counter[path_key]["count"] += 1
                        path_counter[path_key]["status_codes"][sc] += 1
                        path_counter[path_key]["method"] = entry.method
                        path_counter[path_key]["path"] = entry.path

                        client_counter[entry.client_ip]["count"] += 1
                        client_counter[entry.client_ip]["paths"][path_key] += 1
                        client_counter[entry.client_ip]["status_codes"][sc] += 1

            await _update_progress(db, analysis, "결과를 저장하고 있습니다...")

            analysis.total_requests = total_requests
            analysis.total_4xx = total_4xx
            analysis.status_code_summary = dict(status_counter)
            analysis.status = "completed"
            analysis.progress_message = None
            analysis.completed_at = datetime.now(timezone.utc)

            sorted_paths = sorted(path_counter.items(), key=lambda x: x[1]["count"], reverse=True)[:50]
            for _key, data in sorted_paths:
                db.add(AnalysisPathStat(
                    analysis_id=analysis_id,
                    request_path=data["path"],
                    method=data["method"],
                    count=data["count"],
                    status_codes=dict(data["status_codes"]),
                ))

            sorted_clients = sorted(client_counter.items(), key=lambda x: x[1]["count"], reverse=True)[:50]
            for ip, data in sorted_clients:
                top_paths = sorted(data["paths"].items(), key=lambda x: x[1], reverse=True)[:5]
                db.add(AnalysisClientStat(
                    analysis_id=analysis_id,
                    client_ip=ip,
                    count=data["count"],
                    top_paths=[{"path": p, "count": c} for p, c in top_paths],
                    status_codes=dict(data["status_codes"]),
                ))

            await db.commit()

        except Exception as e:
            analysis.status = "failed"
            analysis.progress_message = None
            analysis.error_message = f"{type(e).__name__}: {e}"
            analysis.completed_at = datetime.now(timezone.utc)
            await db.commit()
