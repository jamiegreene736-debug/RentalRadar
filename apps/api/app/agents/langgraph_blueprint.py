from __future__ import annotations

from typing import Any


def langgraph_state_machine_blueprint() -> dict[str, Any]:
    """Declarative map for replacing the simple orchestrator with LangGraph.

    Nodes correspond one-to-one with the concrete agent classes in this package.
    """

    return {
        "state": {
            "target": "ScrapeTarget",
            "analysis": "SiteAnalysis | None",
            "strategy": "ScraperStrategyPlan | None",
            "result": "ScrapeExecutionResult | None",
            "healed": "bool",
        },
        "nodes": {
            "site_analyzer": "SiteAnalyzerAgent.analyze",
            "playwright_trainer": "PlaywrightTrainerAgent.train",
            "scraper_executor": "ScraperExecutorAgent.execute",
            "self_healing": "SelfHealingAgent.heal",
        },
        "edges": [
            ["site_analyzer", "playwright_trainer"],
            ["playwright_trainer", "scraper_executor"],
            {
                "from": "scraper_executor",
                "condition": "result.success and result.extraction_confidence >= min_confidence",
                "to": "END",
            },
            {
                "from": "scraper_executor",
                "condition": "failed_or_low_confidence",
                "to": "self_healing",
            },
            ["self_healing", "scraper_executor"],
        ],
    }
