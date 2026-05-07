from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import get_settings
from app.integrations.types import ConnectorError


class IntegrationHttpClient:
    def __init__(self, base_url: str, headers: dict[str, str] | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = headers or {}
        self.settings = get_settings()

    def request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | list[Any] | None = None,
        content: str | bytes | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        merged_headers = self.headers | (headers or {})
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        last_error: Exception | None = None

        for attempt in range(self.settings.integration_max_retries):
            try:
                with httpx.Client(timeout=self.settings.integration_http_timeout_seconds) as client:
                    response = client.request(
                        method,
                        url,
                        json=json,
                        content=content,
                        params=params,
                        headers=merged_headers,
                    )
                if response.status_code == 429 and attempt + 1 < self.settings.integration_max_retries:
                    retry_after = int(response.headers.get("Retry-After", "2"))
                    time.sleep(min(30, max(1, retry_after)))
                    continue
                if 500 <= response.status_code < 600 and attempt + 1 < self.settings.integration_max_retries:
                    time.sleep(2**attempt)
                    continue
                response.raise_for_status()
                if not response.content:
                    return {}
                content_type = response.headers.get("content-type", "")
                if "json" in content_type:
                    return response.json()
                return {"raw": response.text}
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                if attempt + 1 < self.settings.integration_max_retries:
                    time.sleep(2**attempt)
                    continue
        raise ConnectorError(str(last_error) if last_error else "integration_request_failed")
