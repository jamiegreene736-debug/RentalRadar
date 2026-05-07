from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.async_api import Page

from app.config import get_settings


class BrowserActionLogger:
    def __init__(self, job_id: str, root: str | None = None) -> None:
        settings = get_settings()
        self.job_id = job_id
        self.path = Path(root or settings.browser_action_log_dir) / f"{job_id}.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, event: str, payload: dict[str, Any] | None = None) -> None:
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "job_id": self.job_id,
            "event": event,
            "payload": payload or {},
        }
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, default=str) + "\n")

    async def attach(self, page: Page) -> None:
        page.on("request", lambda request: self.write("request", {"method": request.method, "url": request.url}))
        page.on(
            "response",
            lambda response: self.write(
                "response",
                {"status": response.status, "url": response.url},
            ),
        )
        page.on("console", lambda msg: self.write("console", {"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda exc: self.write("pageerror", {"message": str(exc)}))
