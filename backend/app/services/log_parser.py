import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

# Matches either a quoted token or a non-space token
_TOKEN_RE = re.compile(r'"([^"]*)"|\S+')

# ALB log field indices (0-indexed)
IDX_TIMESTAMP = 1
IDX_CLIENT_PORT = 3
IDX_ELB_STATUS = 8
IDX_TARGET_STATUS = 9
IDX_REQUEST = 12  # quoted: "GET https://... HTTP/1.1"
IDX_USER_AGENT = 13  # quoted


@dataclass
class AlbLogEntry:
    timestamp: str
    client_ip: str
    elb_status_code: int
    target_status_code: str
    method: str
    path: str
    user_agent: str


def parse_line(line: str) -> Optional[AlbLogEntry]:
    """Parse a single ALB log line. Returns None if unparseable."""
    tokens = [
        m.group(1) if m.group(1) is not None else m.group(0)
        for m in _TOKEN_RE.finditer(line)
    ]

    if len(tokens) < 14:
        return None

    try:
        client_ip = tokens[IDX_CLIENT_PORT].rsplit(":", 1)[0]
        elb_status = int(tokens[IDX_ELB_STATUS])

        # Parse request line: "GET https://host/path HTTP/1.1"
        request_parts = tokens[IDX_REQUEST].split(" ", 2)
        method = request_parts[0] if len(request_parts) >= 1 else "-"
        url = request_parts[1] if len(request_parts) >= 2 else "-"

        parsed = urlparse(url)
        path = parsed.path or "/"

        return AlbLogEntry(
            timestamp=tokens[IDX_TIMESTAMP],
            client_ip=client_ip,
            elb_status_code=elb_status,
            target_status_code=tokens[IDX_TARGET_STATUS],
            method=method,
            path=path,
            user_agent=tokens[IDX_USER_AGENT] if len(tokens) > IDX_USER_AGENT else "-",
        )
    except (ValueError, IndexError):
        return None
