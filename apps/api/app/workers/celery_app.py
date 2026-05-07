from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "rentalradar",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.run_scrape_job": {"queue": "scraping"},
        "app.workers.tasks.run_trained_scraping_script": {"queue": "scraping"},
        "app.workers.tasks.run_scheduled_market_scans": {"queue": "scheduler"},
        "app.workers.tasks.push_rate_to_pms": {"queue": "pms"},
        "app.workers.tasks.pull_rates_from_pms": {"queue": "pms"},
        "app.workers.tasks.sync_all_pms_connections": {"queue": "scheduler"},
    },
)

celery_app.conf.beat_schedule = {
    "scheduled-market-scans-hourly": {
        "task": "app.workers.tasks.run_scheduled_market_scans",
        "schedule": crontab(minute=7),
    },
    "scheduled-pms-two-way-sync": {
        "task": "app.workers.tasks.sync_all_pms_connections",
        "schedule": crontab(minute="*/30"),
    },
}
