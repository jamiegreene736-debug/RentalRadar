from __future__ import annotations

import asyncio
import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from playwright.async_api import Page

from app.config import get_settings
from app.db.models import ScrapeJob, ScrapeJobLog
from app.db.session import SessionLocal

DB_EVENT_ALLOWLIST = {
    "browser.launched",
    "browser.shutdown",
    "scrape.canceled",
    "scrape.page_loaded",
    "scrape.live_screenshot",
    "scrape.screenshot",
    "scrape.completed",
    "screenshot.failed",
    "pageerror",
}


class BrowserActionLogger:
    def __init__(self, job_id: str, root: str | None = None) -> None:
        settings = get_settings()
        self.job_id = job_id
        self.path = Path(root or settings.browser_action_log_dir) / f"{job_id}.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, event: str, payload: dict[str, Any] | None = None) -> None:
        payload = payload or {}
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "job_id": self.job_id,
            "event": event,
            "payload": payload,
        }
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, default=str) + "\n")
        self._write_db_event(event, payload)

    async def screenshot(self, page: Page, event: str = "screenshot.captured") -> str | None:
        try:
            screenshot_dir = self.path.parent / "screenshots"
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            screenshot_path = screenshot_dir / f"{self.job_id}-{timestamp}.jpg"
            await page.screenshot(path=str(screenshot_path), type="jpeg", quality=54, full_page=False)
            self._store_latest_screenshot(screenshot_path)
            self.write(event, {"screenshot_path": str(screenshot_path), "has_screenshot": True})
            return str(screenshot_path)
        except Exception as exc:
            self.write("screenshot.failed", {"message": str(exc)})
            return None

    def start_screenshot_heartbeat(
        self,
        page: Page,
        *,
        interval_seconds: float = 3,
        event: str = "scrape.live_screenshot",
    ) -> asyncio.Task[None]:
        return asyncio.create_task(self._screenshot_heartbeat(page, interval_seconds, event))

    async def _screenshot_heartbeat(self, page: Page, interval_seconds: float, event: str) -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                if page.is_closed():
                    return
                await self.screenshot(page, event)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.write("screenshot.failed", {"message": str(exc)})
                return

    async def attach(self, page: Page) -> None:
        page.on("request", lambda request: self.write("request", {"method": request.method, "url": _safe_url(request.url)}))
        page.on(
            "response",
            lambda response: self.write(
                "response",
                {"status": response.status, "url": _safe_url(response.url)},
            ),
        )
        page.on("console", lambda msg: self.write("console", {"type": msg.type, "text": _safe_text(msg.text)}))
        page.on("pageerror", lambda exc: self.write("pageerror", {"message": str(exc)}))

    def _write_db_event(self, event: str, payload: dict[str, Any]) -> None:
        if event not in DB_EVENT_ALLOWLIST and not event.endswith(".failed"):
            return
        try:
            job_id = UUID(self.job_id)
        except ValueError:
            return

        db = SessionLocal()
        try:
            if db.get(ScrapeJob, job_id) is None:
                return
            db.add(
                ScrapeJobLog(
                    scrape_job_id=job_id,
                    level="error" if event.endswith(".failed") or event == "pageerror" else "info",
                    event=event,
                    message=_event_message(event, payload),
                    payload=_safe_payload(payload),
                )
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def _store_latest_screenshot(self, screenshot_path: Path) -> None:
        try:
            job_id = UUID(self.job_id)
            data_url = f"data:image/jpeg;base64,{base64.b64encode(screenshot_path.read_bytes()).decode('ascii')}"
        except (OSError, ValueError):
            return

        db = SessionLocal()
        try:
            job = db.get(ScrapeJob, job_id)
            if job is None:
                return
            job.result_summary = {
                **(job.result_summary or {}),
                "latest_screenshot_data_url": data_url,
                "latest_screenshot_at": datetime.now(timezone.utc).isoformat(),
            }
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def _safe_url(url: str) -> str:
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _safe_text(text: str) -> str:
    lowered = text.lower()
    if any(marker in lowered for marker in ("password", "cookie", "token", "session", "authorization")):
        return "[redacted]"
    return text[:500]


def _safe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    safe = dict(payload)
    screenshot_path = safe.get("screenshot_path")
    if isinstance(screenshot_path, str):
        safe["screenshot_path"] = Path(screenshot_path).name
    return safe


def _event_message(event: str, payload: dict[str, Any]) -> str | None:
    if event == "browser.launched":
        return "Chrome session opened."
    if event in {"scrape.page_loaded", "scrape.live_screenshot", "scrape.screenshot"}:
        return "Chrome screen preview captured."
    if event == "scrape.completed":
        return "Extraction run finished."
    if event == "scrape.canceled":
        return "Chrome session stopped by user."
    if event == "browser.shutdown":
        return "Chrome session closed."
    if "message" in payload:
        return str(payload["message"])
    if "url" in payload:
        return _safe_url(str(payload["url"]))
    return None
