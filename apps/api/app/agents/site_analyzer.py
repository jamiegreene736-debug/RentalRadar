from __future__ import annotations

import hashlib
from urllib.parse import urlparse

from app.agents.types import ScrapeTarget, SiteAnalysis


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
        dom_summary = {
            "domain": parsed.netloc,
            "has_calendar_terms": any(term in lower for term in ["calendar", "date", "availability"]),
            "has_price_terms": any(term in lower for term in ["price", "rate", "$", "night"]),
            "candidate_price_selectors": [
                "[data-testid*='price']",
                "[aria-label*='price' i]",
                ".price",
                ".rate",
            ],
            "candidate_calendar_selectors": [
                "[data-testid*='calendar']",
                "[aria-label*='calendar' i]",
                ".calendar",
                ".date-picker",
            ],
        }
        return SiteAnalysis(
            url=target.url,
            source=target.source,
            title=None,
            dom_summary=dom_summary,
            layout_fingerprint=fingerprint,
            confidence=0.72,
        )
