from __future__ import annotations

from urllib.parse import urlparse

from app.agents.types import ScraperStrategyPlan, SiteAnalysis


class PlaywrightTrainerAgent:
    """Generates robust Playwright locator plans from site analysis."""

    async def train(self, analysis: SiteAnalysis) -> ScraperStrategyPlan:
        domain = urlparse(analysis.url).netloc
        selectors = analysis.dom_summary
        strategy = {
            "version": 1,
            "source": analysis.source.value,
            "domain": domain,
            "layout_fingerprint": analysis.layout_fingerprint,
            "browser": {
                "headless": True,
                "stealth": True,
                "proxy": "{{proxy_url}}",
            },
            "steps": [
                {"action": "goto", "url": "{{target_url}}", "wait_until": "domcontentloaded"},
                {
                    "action": "wait_for_any",
                    "selectors": selectors["candidate_calendar_selectors"]
                    + selectors["candidate_price_selectors"],
                    "timeout_ms": 15000,
                },
                {
                    "action": "extract_rates",
                    "price_selectors": selectors["candidate_price_selectors"],
                    "calendar_selectors": selectors["candidate_calendar_selectors"],
                },
            ],
            "validators": {
                "nightly_rate_min_cents": 2000,
                "nightly_rate_max_cents": 500000,
                "min_confidence": 0.6,
            },
        }
        return ScraperStrategyPlan(
            source=analysis.source,
            domain=domain,
            layout_fingerprint=analysis.layout_fingerprint,
            strategy_json=strategy,
            confidence=analysis.confidence,
        )
