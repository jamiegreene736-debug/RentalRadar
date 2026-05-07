from __future__ import annotations

from app.agents.playwright_trainer import PlaywrightTrainerAgent
from app.agents.site_analyzer import SiteAnalyzerAgent
from app.agents.types import ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan


class SelfHealingAgent:
    """Retrains selectors after a scrape failure or low-confidence extraction."""

    def __init__(
        self,
        analyzer: SiteAnalyzerAgent | None = None,
        trainer: PlaywrightTrainerAgent | None = None,
    ) -> None:
        self.analyzer = analyzer or SiteAnalyzerAgent()
        self.trainer = trainer or PlaywrightTrainerAgent()

    async def heal(
        self,
        target: ScrapeTarget,
        failed_result: ScrapeExecutionResult,
    ) -> ScraperStrategyPlan:
        html_hint = str(failed_result.diagnostics) + (failed_result.error_message or "")
        analysis = await self.analyzer.analyze(target, html=html_hint)
        repaired = await self.trainer.train(analysis)
        repaired.strategy_json["repair_context"] = {
            "error_message": failed_result.error_message,
            "previous_layout_fingerprint": failed_result.layout_fingerprint,
        }
        return repaired
