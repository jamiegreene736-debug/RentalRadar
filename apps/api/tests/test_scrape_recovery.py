from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import uuid4

from app.api.routes import properties
from app.db.models import ScrapeJob, ScrapeJobStatus, ScrapeSource
from app.schemas import ScrapeSessionEventResponse


class _ScalarResult:
    def __init__(self, items: list[ScrapeJob]) -> None:
        self._items = items

    def all(self) -> list[ScrapeJob]:
        return self._items


def test_stale_running_scrape_without_browser_heartbeat_is_requeued(monkeypatch) -> None:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=uuid4(),
        property_id=uuid4(),
        source=ScrapeSource.airbnb,
        target_url="https://www.airbnb.com/s/test/homes",
        status=ScrapeJobStatus.running,
        attempts=1,
        max_attempts=3,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        request_context={},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([job])
    delay = Mock()
    monkeypatch.setattr(properties, "_db_scrape_events", lambda *_: [])
    monkeypatch.setattr(properties, "_browser_action_events", lambda _: [])
    monkeypatch.setattr(properties, "_latest_screenshot_data_url", lambda _: None)
    monkeypatch.setattr(properties.run_scrape_job, "delay", delay)

    properties._recover_stale_running_jobs(db, job.property_id, job.organization_id)

    assert job.status == ScrapeJobStatus.queued
    assert job.started_at is None
    assert job.error_code == "chrome_heartbeat_missing"
    assert job.request_context["stale_heartbeat_requeues"] == 1
    db.commit.assert_called_once()
    delay.assert_called_once_with(str(job.id))


def test_stale_running_scrape_with_existing_requeue_needs_review(monkeypatch) -> None:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=uuid4(),
        property_id=uuid4(),
        source=ScrapeSource.airbnb,
        target_url="https://www.airbnb.com/s/test/homes",
        status=ScrapeJobStatus.running,
        attempts=3,
        max_attempts=3,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        request_context={"stale_heartbeat_requeues": 1},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([job])
    delay = Mock()
    monkeypatch.setattr(properties, "_db_scrape_events", lambda *_: [])
    monkeypatch.setattr(properties, "_browser_action_events", lambda _: [])
    monkeypatch.setattr(properties, "_latest_screenshot_data_url", lambda _: None)
    monkeypatch.setattr(properties.run_scrape_job, "delay", delay)

    properties._recover_stale_running_jobs(db, job.property_id, job.organization_id)

    assert job.status == ScrapeJobStatus.needs_review
    assert job.completed_at is not None
    assert job.error_code == "chrome_heartbeat_missing"
    db.commit.assert_called_once()
    delay.assert_not_called()


def test_needs_review_without_browser_evidence_is_not_complete() -> None:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=uuid4(),
        property_id=uuid4(),
        source=ScrapeSource.airbnb,
        target_url="https://www.airbnb.com/s/test/homes",
        status=ScrapeJobStatus.needs_review,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        error_message="Chrome worker picked up the scan but never emitted a browser heartbeat.",
    )

    assert properties._scrape_progress_percent(job, [], None, None) == 34
    assert properties._scrape_progress_label(job, [], None) == job.error_message


def test_needs_review_with_browser_events_keeps_evidence_progress() -> None:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=uuid4(),
        property_id=uuid4(),
        source=ScrapeSource.airbnb,
        target_url="https://www.airbnb.com/s/test/homes",
        status=ScrapeJobStatus.needs_review,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        error_message="Extraction confidence was too low.",
    )
    events = [
        ScrapeSessionEventResponse(
            at=datetime.now(timezone.utc),
            event="browser.launched",
            level="info",
            message="Chrome session opened",
        )
    ]

    assert properties._scrape_progress_percent(job, events, None, None) == 68
    assert properties._scrape_progress_percent(job, events, "data:image/jpeg;base64,abc", None) == 82
