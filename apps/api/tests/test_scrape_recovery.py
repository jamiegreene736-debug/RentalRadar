from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import uuid4

from app.api.routes import properties
from app.browser_farm import runner
from app.browser_farm.proxy import ProxyRotator
from app.config import get_settings
from app.db.models import ScrapeJob, ScrapeJobStatus, ScrapeSource
from app.schemas import ScrapeSessionEventResponse
from app.workers import tasks


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


def test_manual_retry_policy_allows_limited_retry_chain() -> None:
    organization_id = uuid4()
    property_id = uuid4()
    root = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, tzinfo=timezone.utc),
    )
    retry_one = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, 5, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(root.id)},
    )
    retry_two = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, 10, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(retry_one.id)},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([root, retry_one, retry_two])

    policy = properties._manual_retry_policy(db, retry_two)

    assert policy["retry_eligible"] is True
    assert policy["manual_retry_attempts_used"] == 2
    assert policy["manual_retry_limit"] == 3
    assert policy["retry_root_job_id"] == str(root.id)


def test_manual_retry_policy_stops_after_limit() -> None:
    organization_id = uuid4()
    property_id = uuid4()
    root = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, tzinfo=timezone.utc),
    )
    retry_one = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, 5, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(root.id)},
    )
    retry_two = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, 10, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(retry_one.id)},
    )
    retry_three = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, 15, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(retry_two.id)},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([root, retry_one, retry_two, retry_three])

    policy = properties._manual_retry_policy(db, retry_three)

    assert policy["retry_eligible"] is False
    assert policy["manual_retry_attempts_used"] == 3
    assert "Retry limit reached" in policy["retry_disabled_reason"]


def test_manual_retry_policy_blocks_old_scan_after_newer_success() -> None:
    organization_id = uuid4()
    property_id = uuid4()
    root = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, tzinfo=timezone.utc),
    )
    retry_success = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.succeeded,
        created_at=datetime(2026, 5, 20, 12, 5, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(root.id)},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([root, retry_success])

    policy = properties._manual_retry_policy(db, root)

    assert policy["retry_eligible"] is False
    assert policy["superseded_by_job_id"] == str(retry_success.id)
    assert policy["retry_disabled_reason"] == "This scan already completed in a newer retry."


def test_manual_retry_policy_labels_completed_scan_as_complete() -> None:
    organization_id = uuid4()
    property_id = uuid4()
    root = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.failed,
        created_at=datetime(2026, 5, 20, 12, tzinfo=timezone.utc),
    )
    retry_success = _scrape_job(
        organization_id=organization_id,
        property_id=property_id,
        status=ScrapeJobStatus.succeeded,
        created_at=datetime(2026, 5, 20, 12, 5, tzinfo=timezone.utc),
        request_context={"trigger": "manual_retry", "retried_from_job_id": str(root.id)},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([root, retry_success])

    policy = properties._manual_retry_policy(db, retry_success)

    assert policy["retry_eligible"] is False
    assert policy["retry_disabled_reason"] == "This scan already completed."


def test_current_page_url_ignores_telemetry_requests() -> None:
    now = datetime.now(timezone.utc)
    events = [
        ScrapeSessionEventResponse(
            at=now,
            event="request",
            level="info",
            message="POST https://browser-intake-datadoghq.com/api/v2/rum",
            url="https://browser-intake-datadoghq.com/api/v2/rum",
        ),
        ScrapeSessionEventResponse(
            at=now - timedelta(seconds=1),
            event="request",
            level="info",
            message="POST https://www.vrbo.com/api/uisprime/track",
            url="https://www.vrbo.com/api/uisprime/track",
        ),
        ScrapeSessionEventResponse(
            at=now - timedelta(seconds=2),
            event="scrape.failed",
            level="error",
            message="No visible OTA prices were extracted.",
            url="https://www.vrbo.com/",
        ),
    ]

    assert properties._current_page_url("https://www.vrbo.com/search?destination=test", events) == "https://www.vrbo.com/"


def test_worker_boot_republishes_queued_scrape_jobs(monkeypatch) -> None:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=uuid4(),
        property_id=uuid4(),
        source=ScrapeSource.vrbo,
        target_url="https://www.vrbo.com/search/keywords:test?d1=2026-07-13&d2=2026-07-20",
        status=ScrapeJobStatus.queued,
        attempts=1,
        request_context={"trigger": "manual_property_rerun"},
    )
    db = Mock()
    db.scalars.return_value = _ScalarResult([job])
    delay = Mock()
    monkeypatch.setattr(tasks, "SessionLocal", Mock(return_value=db))
    monkeypatch.setattr(tasks.run_scrape_job, "delay", delay)

    requeued = tasks._requeue_queued_scrape_jobs()

    assert requeued == 1
    assert "worker_boot_requeued_at" in job.request_context
    db.commit.assert_called_once()
    delay.assert_called_once_with(str(job.id))


def test_vrbo_bot_or_not_page_is_classified_as_browser_blocker() -> None:
    blocker = runner._blocker_from_text(
        title="Bot or Not?",
        body_text="",
        html='{"whichChallenge":"datadome-challenge"}',
        url="https://www.vrbo.com/search/keywords%3A910",
        status=429,
    )

    assert blocker is not None
    assert blocker["kind"] == "bot_challenge"
    assert blocker["http_status"] == 429
    assert tasks._is_non_retryable_browser_blocker(blocker)


def test_http_407_is_classified_as_proxy_auth_blocker() -> None:
    blocker = runner._blocker_from_text(
        title="This page isn't working",
        body_text="HTTP ERROR 407",
        html="",
        url="https://www.airbnb.com/s/test/homes",
        status=407,
    )

    assert blocker is not None
    assert blocker["kind"] == "proxy_auth_required"
    assert "residential proxy" in blocker["message"]
    assert tasks._is_non_retryable_browser_blocker(blocker)


def test_brightdata_proxy_url_credentials_are_split(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost/db")
    monkeypatch.setenv("BRIGHTDATA_PROXY_SERVER", "http://user%40zone:pass%23word@brd.superproxy.io:33335")
    monkeypatch.delenv("BRIGHTDATA_PROXY_USERNAME", raising=False)
    monkeypatch.delenv("BRIGHTDATA_PROXY_PASSWORD", raising=False)
    try:
        lease = ProxyRotator(redis_client=Mock())._lease_from_brightdata("job-123")
    finally:
        get_settings.cache_clear()

    assert lease is not None
    assert lease.server == "http://brd.superproxy.io:33335"
    assert lease.username == "user@zone"
    assert lease.password == "pass#word"


def test_brightdata_proxy_server_can_be_built_from_host_and_port(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost/db")
    monkeypatch.delenv("BRIGHTDATA_PROXY_SERVER", raising=False)
    monkeypatch.setenv("BRIGHTDATA_PROXY_HOST", "brd.superproxy.io")
    monkeypatch.setenv("BRIGHTDATA_PROXY_PORT", "33335")
    monkeypatch.setenv("BRIGHTDATA_PROXY_USERNAME", "customer-{session}")
    monkeypatch.setenv("BRIGHTDATA_PROXY_PASSWORD", "secret")
    try:
        lease = ProxyRotator(redis_client=Mock())._lease_from_brightdata("abc-123")
    finally:
        get_settings.cache_clear()

    assert lease is not None
    assert lease.server == "http://brd.superproxy.io:33335"
    assert lease.username == "customer-rrabc123"
    assert lease.password == "secret"


def _scrape_job(
    *,
    organization_id,
    property_id,
    status: ScrapeJobStatus,
    created_at: datetime,
    request_context: dict | None = None,
) -> ScrapeJob:
    job = ScrapeJob(
        id=uuid4(),
        organization_id=organization_id,
        property_id=property_id,
        source=ScrapeSource.airbnb,
        target_url="https://www.airbnb.com/s/test/homes",
        stay_date_start=datetime(2026, 7, 1, tzinfo=timezone.utc).date(),
        stay_date_end=datetime(2026, 7, 7, tzinfo=timezone.utc).date(),
        status=status,
        request_context=request_context or {},
    )
    job.created_at = created_at
    return job
