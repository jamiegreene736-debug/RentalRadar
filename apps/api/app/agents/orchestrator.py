from __future__ import annotations

from dataclasses import dataclass

from app.agents.executor import ScraperExecutorAgent
from app.agents.playwright_trainer import PlaywrightTrainerAgent
from app.agents.self_healing import SelfHealingAgent
from app.agents.site_analyzer import SiteAnalyzerAgent
from app.agents.types import ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan


@dataclass
class AgentRun:
    strategy: ScraperStrategyPlan
    result: ScrapeExecutionResult
    healed: bool


class MarketScrapeOrchestrator:
    """CrewAI/LangGraph-ready orchestration boundary for specialized agents."""

    def __init__(
        self,
        analyzer: SiteAnalyzerAgent | None = None,
        trainer: PlaywrightTrainerAgent | None = None,
        executor: ScraperExecutorAgent | None = None,
        healer: SelfHealingAgent | None = None,
    ) -> None:
        self.analyzer = analyzer or SiteAnalyzerAgent()
        self.trainer = trainer or PlaywrightTrainerAgent()
        self.executor = executor or ScraperExecutorAgent()
        self.healer = healer or SelfHealingAgent(self.analyzer, self.trainer)

    async def run(self, target: ScrapeTarget) -> AgentRun:
        analysis = await self.analyzer.analyze(target)
        strategy = await self.trainer.train(analysis)
        result = await self.executor.execute(target, strategy)

        if result.success and result.extraction_confidence >= strategy.strategy_json["validators"]["min_confidence"]:
            return AgentRun(strategy=strategy, result=result, healed=False)

        repaired_strategy = await self.healer.heal(target, result)
        repaired_result = await self.executor.execute(target, repaired_strategy)
        return AgentRun(strategy=repaired_strategy, result=repaired_result, healed=True)
