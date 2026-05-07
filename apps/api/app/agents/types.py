from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.db.models import ScrapeSource


@dataclass(frozen=True)
class ScrapeTarget:
    source: ScrapeSource
    url: str
    stay_date_start: date
    stay_date_end: date
    proxy_url: str | None = None


@dataclass
class SiteAnalysis:
    url: str
    source: ScrapeSource
    title: str | None
    dom_summary: dict[str, Any]
    layout_fingerprint: str
    confidence: float


@dataclass
class ScraperStrategyPlan:
    source: ScrapeSource
    domain: str
    layout_fingerprint: str
    strategy_json: dict[str, Any]
    confidence: float


@dataclass
class ExtractedRate:
    stay_date: date
    nightly_rate_cents: int | None
    total_rate_cents: int | None
    available: bool | None
    min_nights: int | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class ScrapeExecutionResult:
    success: bool
    rates: list[ExtractedRate] = field(default_factory=list)
    screenshot_url: str | None = None
    raw_html_url: str | None = None
    dom_fingerprint: str | None = None
    layout_fingerprint: str | None = None
    extraction_confidence: float = 0
    error_message: str | None = None
    diagnostics: dict[str, Any] = field(default_factory=dict)
