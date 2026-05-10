from __future__ import annotations

import hashlib
from urllib.parse import urlparse

from app.agents.types import ScrapeTarget, SiteAnalysis
from app.db.models import ScrapeSource


class SiteAnalyzerAgent:
    """Visits an OTA/PMS page and summarizes DOM signals for the trainer.

    The Playwright implementation is intentionally lightweight here; the agent
    returns deterministic fingerprints even when external browser access is not
    available in local development.
    """

    async def analyze(self, target: ScrapeTarget, html: str | None = None) -> SiteAnalysis:
        parsed = urlparse(target.url)
        dom_text = html or parsed.netloc + parsed.path
        fingerprint = hashlib.sha256(f"{target.source.value}:{dom_text[:5000]}".encode()).hexdigest()[:16]
        lower = dom_text.lower()
        selectors = _selectors_for_source(target.source)
        dom_summary = {
            "domain": parsed.netloc,
            "has_calendar_terms": any(term in lower for term in ["calendar", "date", "availability"]),
            "has_price_terms": any(term in lower for term in ["price", "rate", "$", "night"]),
            "candidate_price_selectors": selectors["price"],
            "candidate_calendar_selectors": selectors["calendar"],
            "candidate_result_selectors": selectors["results"],
        }
        return SiteAnalysis(
            url=target.url,
            source=target.source,
            title=None,
            dom_summary=dom_summary,
            layout_fingerprint=fingerprint,
            confidence=0.72,
        )


def _selectors_for_source(source: ScrapeSource) -> dict[str, list[str]]:
    common_price = [
        "[data-testid*='price' i]",
        "[aria-label*='price' i]",
        "[class*='price' i]",
        "[class*='rate' i]",
    ]
    common_calendar = [
        "[data-testid*='calendar' i]",
        "[aria-label*='calendar' i]",
        "[class*='calendar' i]",
        "[class*='date-picker' i]",
    ]
    if source == ScrapeSource.booking:
        return {
            "price": [
                "[data-testid='price-and-discounted-price']",
                "[data-testid='availability-rate-information']",
                "[data-testid='property-card'] [data-testid*='price' i]",
                *common_price,
            ],
            "calendar": common_calendar,
            "results": [
                "[data-testid='property-card']",
                "[data-testid='searchresults']",
                "#search_results_table",
            ],
        }
    if source == ScrapeSource.airbnb:
        return {
            "price": [
                "[data-testid='price-availability-row']",
                "[data-testid*='price' i]",
                "[aria-label*='total' i]",
                *common_price,
            ],
            "calendar": common_calendar,
            "results": [
                "[data-testid='card-container']",
                "[itemprop='itemListElement']",
                "[data-testid*='listing' i]",
            ],
        }
    if source == ScrapeSource.vrbo:
        return {
            "price": [
                "[data-stid*='price' i]",
                "[data-testid*='price' i]",
                "[aria-label*='price' i]",
                *common_price,
            ],
            "calendar": common_calendar,
            "results": [
                "[data-stid='property-listing']",
                "[data-testid*='property' i]",
                "[class*='listing' i]",
            ],
        }
    return {"price": common_price, "calendar": common_calendar, "results": []}
