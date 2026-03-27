import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alarm_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_prefix: Mapped[str] = mapped_column(String(1024), default="")
    total_requests: Mapped[int] = mapped_column(Integer, default=0)
    total_4xx: Mapped[int] = mapped_column(Integer, default=0)
    status_code_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    source_type: Mapped[str] = mapped_column(String(20), default="alb")  # 'alb' or 'cloudfront'
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    path_stats: Mapped[list["AnalysisPathStat"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    client_stats: Mapped[list["AnalysisClientStat"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")


class AnalysisPathStat(Base):
    __tablename__ = "analysis_path_stats"
    __table_args__ = (Index("ix_path_stats_analysis_count", "analysis_id", "count"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    request_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    status_codes: Mapped[dict] = mapped_column(JSONB, default=dict)

    analysis: Mapped["Analysis"] = relationship(back_populates="path_stats")


class AnalysisClientStat(Base):
    __tablename__ = "analysis_client_stats"
    __table_args__ = (Index("ix_client_stats_analysis_count", "analysis_id", "count"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    client_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    top_paths: Mapped[list] = mapped_column(JSONB, default=list)
    status_codes: Mapped[dict] = mapped_column(JSONB, default=dict)

    analysis: Mapped["Analysis"] = relationship(back_populates="client_stats")
