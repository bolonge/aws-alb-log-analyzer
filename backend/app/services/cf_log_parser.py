from dataclasses import dataclass
from typing import Optional


# CloudFront log is tab-delimited. Lines starting with '#' are headers.
# Field order (0-indexed):
# 0:date  1:time  2:x-edge-location  3:sc-bytes  4:c-ip  5:cs-method
# 6:cs(Host)  7:cs-uri-stem  8:sc-status  9:cs(Referer)  10:cs(User-Agent)
# 11:cs-uri-query  12:cs(Cookie)  13:x-edge-result-type  ...

IDX_DATE = 0
IDX_TIME = 1
IDX_CLIENT_IP = 4
IDX_METHOD = 5
IDX_URI_STEM = 7
IDX_STATUS = 8
IDX_USER_AGENT = 10


@dataclass
class CfLogEntry:
    timestamp: str
    client_ip: str
    status_code: int
    method: str
    path: str
    user_agent: str


def parse_cf_line(line: str) -> Optional[CfLogEntry]:
    """Parse a single CloudFront log line. Returns None for headers or unparseable lines."""
    if not line or line.startswith("#"):
        return None

    parts = line.split("\t")
    if len(parts) < 12:
        return None

    try:
        status = int(parts[IDX_STATUS])
        path = parts[IDX_URI_STEM] or "/"

        return CfLogEntry(
            timestamp=f"{parts[IDX_DATE]}T{parts[IDX_TIME]}Z",
            client_ip=parts[IDX_CLIENT_IP],
            status_code=status,
            method=parts[IDX_METHOD],
            path=path,
            user_agent=parts[IDX_USER_AGENT] if len(parts) > IDX_USER_AGENT else "-",
        )
    except (ValueError, IndexError):
        return None
