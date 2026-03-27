from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AnalysisCreate(BaseModel):
    alarm_time: datetime
    source_type: str = "alb"  # 'alb' or 'cloudfront'
    s3_bucket: Optional[str] = None
    s3_prefix: Optional[str] = None


class PathStatResponse(BaseModel):
    request_path: str
    method: str
    count: int
    status_codes: dict[str, int]

    model_config = {"from_attributes": True}


class ClientStatResponse(BaseModel):
    client_ip: str
    count: int
    top_paths: list[dict]
    status_codes: dict[str, int]

    model_config = {"from_attributes": True}


class AnalysisSummary(BaseModel):
    id: UUID
    alarm_time: datetime
    total_requests: int
    total_4xx: int
    source_type: str
    status: str
    progress_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisDetail(AnalysisSummary):
    window_start: datetime
    window_end: datetime
    s3_bucket: str
    s3_prefix: str
    status_code_summary: dict[str, int]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    path_stats: list[PathStatResponse]
    client_stats: list[ClientStatResponse]


class AnalysisListResponse(BaseModel):
    items: list[AnalysisSummary]
    total: int
    page: int
    page_size: int
