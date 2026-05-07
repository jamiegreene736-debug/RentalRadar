from __future__ import annotations

from typing import Any, TypedDict

from app.agents.executor import ScraperExecutorAgent
from app.agents.playwright_trainer import PlaywrightTrainerAgent
from app.agents.self_healing import SelfHealingAgent
from app.agents.site_analyzer import SiteAnalyzerAgent
from app.agents.types import ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan, SiteAnalysis


class ScrapeGraphState(TypedDict, total=False):
    target: ScrapeTarget
    analysis: SiteAnalysis
    strategy: ScraperStrategyPlan
    result: ScrapeExecutionResult
    healed: bool


def build_langgraph_scrape_app() -> Any:
    """Compile the multi-agent scraper as a LangGraph app.

    `langgraph` is an optional extra so the regular FastAPI and Celery runtime
    can operate with the built-in orchestrator. Install with `pip install -e .[agents]`.
    """

    try:
        from langgraph.graph import END, StateGraph
    except ImportError as exc:
        raise RuntimeError("Install the agents extra: pip install -e '.[agents]'") from exc

    analyzer = SiteAnalyzerAgent()
    trainer = PlaywrightTrainerAgent()
    executor = ScraperExecutorAgent()
    healer = SelfHealingAgent(analyzer, trainer)

    async def analyze(state: ScrapeGraphState) -> ScrapeGraphState:
        return {"analysis": await analyzer.analyze(state["target"])}

    async def train(state: ScrapeGraphState) -> ScrapeGraphState:
        return {"strategy": await trainer.train(state["analysis"])}

    async def execute(state: ScrapeGraphState) -> ScrapeGraphState:
        return {"result": await executor.execute(state["target"], state["strategy"])}

    async def heal(state: ScrapeGraphState) -> ScrapeGraphState:
        return {
            "strategy": await healer.heal(state["target"], state["result"]),
            "healed": True,
        }

    def route_after_execute(state: ScrapeGraphState) -> str:
        result = state["result"]
        strategy = state["strategy"]
        min_confidence = strategy.strategy_json["validators"]["min_confidence"]
        if result.success and result.extraction_confidence >= min_confidence:
            return "done"
        if state.get("healed"):
            return "done"
        return "heal"

    graph = StateGraph(ScrapeGraphState)
    graph.add_node("site_analyzer", analyze)
    graph.add_node("playwright_trainer", train)
    graph.add_node("scraper_executor", execute)
    graph.add_node("self_healing", heal)
    graph.set_entry_point("site_analyzer")
    graph.add_edge("site_analyzer", "playwright_trainer")
    graph.add_edge("playwright_trainer", "scraper_executor")
    graph.add_conditional_edges("scraper_executor", route_after_execute, {"done": END, "heal": "self_healing"})
    graph.add_edge("self_healing", "scraper_executor")
    return graph.compile()
