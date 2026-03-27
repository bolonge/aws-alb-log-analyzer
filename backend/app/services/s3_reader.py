import gzip
from datetime import datetime, timedelta

import boto3

from app.config import Settings


def _get_s3_client(s: Settings):
    kwargs = {"region_name": s.aws_region}
    if s.aws_access_key_id:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
    if s.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.client("s3", **kwargs)


def list_log_keys(
    s: Settings,
    window_start: datetime,
    window_end: datetime,
) -> list[str]:
    """List S3 keys for ALB logs within the time window.

    ALB log key format:
    {prefix}/yyyy/mm/dd/{account}_elasticloadbalancing_{region}_app.{lb-id}_{end-time}_{ip}_{random}.log.gz
    """
    client = _get_s3_client(s)
    keys: list[str] = []
    current_date = window_start.date()
    end_date = window_end.date()

    while current_date <= end_date:
        prefix = f"{s.s3_prefix}/{current_date.strftime('%Y/%m/%d')}/"
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=s.s3_bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                # Try to filter by embedded timestamp in filename
                try:
                    filename = key.rsplit("/", 1)[-1]
                    parts = filename.split("_")
                    time_parts = [
                        p for p in parts if len(p) >= 13 and "T" in p and p.endswith("Z")
                    ]
                    if time_parts:
                        file_time = datetime.strptime(time_parts[0], "%Y%m%dT%H%MZ")
                        if window_start.replace(tzinfo=None) <= file_time <= window_end.replace(tzinfo=None):
                            keys.append(key)
                    else:
                        keys.append(key)
                except (ValueError, IndexError):
                    keys.append(key)
        current_date += timedelta(days=1)

    return keys


def _parse_cf_date_part(filename: str) -> str | None:
    """Extract YYYY-MM-DD-HH from a CloudFront log filename."""
    parts = filename.split(".")
    return next(
        (p for p in parts if len(p) == 13 and p[4] == "-" and p[7] == "-" and p[10] == "-"),
        None,
    )


def list_cf_log_keys(
    s: Settings,
    window_start: datetime,
    window_end: datetime,
) -> list[str]:
    """List S3 keys for CloudFront logs within the time window.

    CloudFront log key format (flat, no date subdirectories):
    {prefix}{distribution-id}.{YYYY-MM-DD}-{HH}.{unique-id}.gz

    Optimization: files are sorted lexicographically in S3.
    Since filenames start with the same dist-id, the date portion sorts correctly.
    We use StartAfter to skip old files and stop early when past the window.
    """
    client = _get_s3_client(s)
    keys: list[str] = []
    scan_start = window_start.replace(tzinfo=None)
    scan_end = window_end.replace(tzinfo=None)

    # Normalize prefix to always end with /
    prefix = s.cf_s3_prefix.rstrip("/") + "/"

    # Step 1: Get the distribution ID from the first real file in the prefix
    resp = client.list_objects_v2(Bucket=s.s3_bucket, Prefix=prefix, MaxKeys=10)
    dist_id = None
    for obj in resp.get("Contents", []):
        filename = obj["Key"].rsplit("/", 1)[-1]
        if _parse_cf_date_part(filename):
            dist_id = filename.split(".")[0]
            break

    if not dist_id:
        return []

    # Step 2: Use StartAfter to jump directly to files near window_start
    # One hour buffer to not miss files right at the boundary
    start_dt = scan_start - timedelta(hours=1)
    start_after = f"{prefix}{dist_id}.{start_dt.strftime('%Y-%m-%d-%H')}"

    resp = client.list_objects_v2(
        Bucket=s.s3_bucket,
        Prefix=prefix,
        StartAfter=start_after,
    )

    while True:
        done = False
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            filename = key.rsplit("/", 1)[-1]
            date_part = _parse_cf_date_part(filename)
            if not date_part:
                continue
            try:
                file_hour = datetime.strptime(date_part, "%Y-%m-%d-%H")
                # Stop early once we're past the window
                if file_hour > scan_end:
                    done = True
                    break
                file_hour_end = file_hour + timedelta(hours=1)
                if file_hour_end > scan_start:
                    keys.append(key)
            except ValueError:
                continue

        if done or not resp.get("IsTruncated"):
            break

        resp = client.list_objects_v2(
            Bucket=s.s3_bucket,
            Prefix=prefix,
            ContinuationToken=resp["NextContinuationToken"],
        )

    return keys


def read_log_file(s: Settings, key: str) -> list[str]:
    """Download and decompress a single .log.gz file, return lines."""
    client = _get_s3_client(s)
    response = client.get_object(Bucket=s.s3_bucket, Key=key)
    compressed = response["Body"].read()
    decompressed = gzip.decompress(compressed)
    return decompressed.decode("utf-8").strip().split("\n")
