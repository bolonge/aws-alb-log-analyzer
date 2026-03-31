# ALB Log Analyzer

A web application that analyzes 4xx errors from AWS ALB and CloudFront logs stored in S3, centered around a CloudWatch alarm trigger time.

---

## Features

- Analyze **ALB** or **CloudFront** access logs stored in S3
- Set a CloudWatch alarm trigger time and analyze logs within a ±30 minute window
- Select input timezone — **UTC** (default) or **KST (+09:00)**
- View top 50 error paths and client IPs ranked by 4xx count
- Real-time progress bar and status messages during analysis
- Delete past analysis records

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React + TypeScript + Vite + React Router |
| Backend  | FastAPI + SQLAlchemy (async) + asyncpg  |
| Database | PostgreSQL 16                           |
| Infra    | Docker / Docker Compose                 |

---

## Quick Start (Docker)

### 1. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```dotenv
# .env
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
AWS_REGION=ap-northeast-2

S3_BUCKET=your-log-bucket
S3_PREFIX=AWSLogs/123456789012/elasticloadbalancing/ap-northeast-2
CF_S3_PREFIX=AWSCFLogs/your-distribution-prefix/
```

> **Note:** `.env` is listed in `.gitignore` and will never be committed.

### 2. Run

```bash
docker compose up --build
```

| Service  | URL                      |
|----------|--------------------------|
| Frontend | http://localhost         |
| Backend  | http://localhost:8000    |
| API Docs | http://localhost:8000/docs |

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Requires a local PostgreSQL database. Set `DATABASE_URL` in `.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://youruser@localhost:5432/alb_analyzer
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`.

---

## S3 Log Path Structure

### ALB Logs

```
s3://<bucket>/<prefix>/<region>/<account-id>/elasticloadbalancing/<year>/<month>/<day>/
```

### CloudFront Logs

```
s3://<bucket>/<cf_prefix>/<distribution-id>.<YYYY-MM-DD-HH>.<unique-id>.gz
```

CloudFront logs are stored flat (no date subdirectories). The analyzer uses S3 `StartAfter` to skip directly to the relevant time window, avoiding full enumeration of large log directories.

---

## AWS IAM Permissions

The AWS credentials provided in `.env` require the following minimum permissions on the S3 bucket containing the logs.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-log-bucket"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-log-bucket/*"
    }
  ]
}
```

| Action         | Purpose                                        |
|----------------|------------------------------------------------|
| `s3:ListBucket` | List log files within the time window         |
| `s3:GetObject`  | Download and parse each log file              |

> No write permissions (`s3:PutObject`, `s3:DeleteObject`) are needed. Creating a dedicated IAM user or role with only these two actions is recommended.

---

## Environment Variables

| Variable                | Description                                       | Default                         |
|-------------------------|---------------------------------------------------|---------------------------------|
| `DATABASE_URL`          | PostgreSQL async connection string                | `postgresql+asyncpg://postgres:postgres@localhost:5432/alb_analyzer` |
| `AWS_ACCESS_KEY_ID`     | AWS access key                                    | —                               |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                                    | —                               |
| `AWS_REGION`            | AWS region                                        | `ap-northeast-2`                |
| `S3_BUCKET`             | S3 bucket name containing logs                    | —                               |
| `S3_PREFIX`             | ALB log prefix                                    | —                               |
| `CF_S3_PREFIX`          | CloudFront log prefix                             | `cloudfront-logs/`              |
| `ANALYSIS_WINDOW_MINUTES` | Minutes before/after alarm time to analyze      | `30`                            |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── config.py          # Settings (pydantic-settings)
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   └── analyses.py    # REST API endpoints
│   │   └── services/
│   │       ├── analyzer.py    # Analysis pipeline (background task)
│   │       ├── s3_reader.py   # S3 log listing and download
│   │       ├── log_parser.py  # ALB log line parser
│   │       └── cf_log_parser.py # CloudFront log line parser
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalysisList.tsx   # Analysis list with delete
│   │   │   ├── AnalysisDetail.tsx # Detail view with progress polling
│   │   │   └── TriggerForm.tsx    # Create analysis form (ALB / CF toggle)
│   │   ├── api.ts                 # API client functions
│   │   └── types.ts               # TypeScript type definitions
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .env                       # Not committed — see .env.example
```
