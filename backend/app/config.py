from pathlib import Path

from pydantic_settings import BaseSettings

# .env is at project root (one level above backend/); ignored if not found (e.g. Docker)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/alb_analyzer"

    # AWS
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-northeast-2"
    s3_bucket: str = "your-alb-log-bucket"
    s3_prefix: str = "AWSLogs/123456789012/elasticloadbalancing/ap-northeast-2"
    cf_s3_prefix: str = "cloudfront-logs/"

    # Analysis defaults
    analysis_window_minutes: int = 30

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    model_config = {
        "env_file": str(_ENV_FILE) if _ENV_FILE.exists() else None,
        "env_file_encoding": "utf-8",
    }


settings = Settings()
