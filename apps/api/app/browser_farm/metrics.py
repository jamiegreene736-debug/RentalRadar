from __future__ import annotations

import threading

import psutil
from prometheus_client import Counter, Gauge, Histogram, start_http_server

from app.config import get_settings
from app.services.cache import get_redis

BROWSER_ACTIVE = Gauge("rentalradar_browser_active", "Active headed browser sessions")
BROWSER_LAUNCH_FAILURES = Counter("rentalradar_browser_launch_failures_total", "Browser launch failures")
SCRAPE_SUCCESS = Counter("rentalradar_scrape_success_total", "Successful scrape jobs")
SCRAPE_FAILURE = Counter("rentalradar_scrape_failure_total", "Failed scrape jobs")
SCRAPE_SECONDS = Histogram("rentalradar_scrape_duration_seconds", "Scrape task duration")
PROXY_USAGE = Counter("rentalradar_proxy_usage_total", "Proxy usage by provider/server", ["provider", "server"])
QUEUE_LENGTH = Gauge("rentalradar_celery_queue_length", "Redis queue length by queue", ["queue"])
WORKER_MEMORY = Gauge("rentalradar_worker_memory_bytes", "Worker RSS memory")

_started = False
_lock = threading.Lock()


def start_metrics_server() -> None:
    global _started
    with _lock:
        if _started:
            return
        start_http_server(get_settings().browser_worker_metrics_port)
        _started = True


def record_proxy(provider: str | None, server: str | None) -> None:
    PROXY_USAGE.labels(provider or "none", server or "none").inc()


def refresh_worker_metrics() -> None:
    WORKER_MEMORY.set(psutil.Process().memory_info().rss)
    redis = get_redis()
    for queue in ("scraping", "pms", "scheduler", "celery"):
        QUEUE_LENGTH.labels(queue).set(redis.llen(queue))
