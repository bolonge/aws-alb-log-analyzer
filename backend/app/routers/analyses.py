from datetime import timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings, settings
from app.database import get_db
from app.models import Analysis
from app.schemas import AnalysisCreate, AnalysisDetail, AnalysisListResponse, AnalysisSummary
from app.services.analyzer import run_analysis

router = APIRouter(prefix="/api/analyses", tags=["analyses"])


def get_settings() -> Settings:
    return settings


@router.post("/", status_code=201)
async def create_analysis(
    body: AnalysisCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    s: Settings = Depends(get_settings),
):
    # Frontend always sends timezone-aware ISO string; convert to UTC
    alarm_time = body.alarm_time
    if alarm_time.tzinfo is None:
        # Fallback: treat naive datetime as UTC
        alarm_time = alarm_time.replace(tzinfo=timezone.utc)
    alarm_utc = alarm_time.astimezone(timezone.utc)
    window = timedelta(minutes=s.analysis_window_minutes)
    # For CloudFront, use cf_s3_prefix as default if no prefix given
    default_prefix = s.cf_s3_prefix if body.source_type == "cloudfront" else s.s3_prefix
    analysis = Analysis(
        alarm_time=alarm_utc,
        window_start=alarm_utc - window,
        window_end=alarm_utc + window,
        s3_bucket=body.s3_bucket or s.s3_bucket,
        s3_prefix=body.s3_prefix or default_prefix,
        source_type=body.source_type,
        status="pending",
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(run_analysis, analysis.id, alarm_utc, s)
    return {"id": str(analysis.id), "status": "pending"}


@router.get("/", response_model=AnalysisListResponse)
async def list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Analysis.id)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(Analysis)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items = result.scalars().all()

    return AnalysisListResponse(
        items=[AnalysisSummary.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{analysis_id}", response_model=AnalysisDetail)
async def get_analysis(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Analysis)
        .options(selectinload(Analysis.path_stats), selectinload(Analysis.client_stats))
        .where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Sort stats by count descending
    analysis.path_stats.sort(key=lambda x: x.count, reverse=True)
    analysis.client_stats.sort(key=lambda x: x.count, reverse=True)

    return AnalysisDetail.model_validate(analysis)


@router.delete("/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    await db.delete(analysis)
    await db.commit()
