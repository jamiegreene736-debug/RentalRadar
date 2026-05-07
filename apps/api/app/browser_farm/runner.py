from __future__ import annotations

import hashlib
from datetime import date
from typing import Any

from app.agents.types import ExtractedRate, ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan
from app.browser_farm.headed import launch_headed_browser
from app.browser_farm.proxy import ProxyLease
from app.browser_farm.stealth import human_scroll, human_type


async def run_trained_scraping_script(
    *,
    job_id: str,
    target: ScrapeTarget,
    strategy: ScraperStrategyPlan,
    proxy: ProxyLease | None,
) -> ScrapeExecutionResult:
    """Run AI-generated Playwright Python code inside a headed isolated session.

    Expected generated-code contract:
      async def scrape(page, context, target, strategy, human):
          ...
          return {"rates": [...], "confidence": 0.8, "diagnostics": {...}}

    If the trainer only produced JSON steps, this runner executes those steps.
    """

    async with launch_headed_browser(job_id=job_id, proxy=proxy) as session:
        generated_code = strategy.strategy_json.get("generated_python")
        if generated_code:
            payload = await execute_generated_scraper_code(
                generated_code,
                page=session.page,
                context=session.context,
                target=target,
                strategy=strategy,
            )
        else:
            payload = await _execute_strategy_steps(session.page, target, strategy)
        await session.action_logger.screenshot(session.page, "scrape.screenshot")
        session.action_logger.write("scrape.completed", {"payload_keys": sorted(payload.keys())})
        return _to_execution_result(payload, target, strategy)


async def execute_generated_scraper_code(
    code: str,
    page: Any,
    context: Any,
    target: ScrapeTarget | None = None,
    strategy: ScraperStrategyPlan | None = None,
) -> dict[str, Any]:
    namespace: dict[str, Any] = {
        "human": {
            "scroll": human_scroll,
            "type": human_type,
        }
    }
    exec(compile(code, "<rentalradar-trained-scraper>", "exec"), namespace)
    scrape = namespace.get("scrape")
    if scrape is not None:
        return await scrape(
            page,
            context,
            target,
            strategy.strategy_json if strategy else {},
            namespace["human"],
        )

    result = namespace.get("result")
    if result is None:
        raise RuntimeError(
            "trained_script must define async scrape(page, context, target, strategy, human) "
            "or assign a result dict"
        )
    return result


async def _execute_strategy_steps(page: Any, target: ScrapeTarget, strategy: ScraperStrategyPlan) -> dict[str, Any]:
    diagnostics: dict[str, Any] = {"mode": "json_strategy"}
    await page.goto(target.url, wait_until="domcontentloaded", timeout=60_000)
    action_logger = getattr(page, "_rentalradar_action_logger", None)
    if action_logger:
        await action_logger.screenshot(page, "scrape.page_loaded")
    await human_scroll(page, min_scrolls=1, max_scrolls=3)
    diagnostics["title"] = await page.title()
    html = await page.content()
    diagnostics["html_sha256"] = hashlib.sha256(html.encode()).hexdigest()

    selectors = []
    for step in strategy.strategy_json.get("steps", []):
        if step.get("action") == "wait_for_any":
            selectors = step.get("selectors", [])
            break
    for selector in selectors:
        try:
            await page.locator(selector).first.wait_for(timeout=5_000)
            diagnostics["matched_selector"] = selector
            break
        except Exception:
            continue

    # The trained extractor is expected to replace this generic rate parser.
    return {
        "rates": [],
        "confidence": 0.64 if diagnostics.get("matched_selector") else 0.42,
        "diagnostics": diagnostics,
        "dom_fingerprint": diagnostics["html_sha256"][:16],
        "raw_html_url": f"memory://{diagnostics['html_sha256']}",
    }


def _to_execution_result(
    payload: dict[str, Any],
    target: ScrapeTarget,
    strategy: ScraperStrategyPlan,
) -> ScrapeExecutionResult:
    rates = [
        ExtractedRate(
            stay_date=_date_value(row["stay_date"]),
            nightly_rate_cents=row.get("nightly_rate_cents"),
            total_rate_cents=row.get("total_rate_cents"),
            available=row.get("available"),
            min_nights=row.get("min_nights"),
            raw_payload=row.get("raw_payload", {}),
        )
        for row in payload.get("rates", [])
    ]
    confidence = float(payload.get("confidence", 0))
    return ScrapeExecutionResult(
        success=confidence >= strategy.strategy_json.get("validators", {}).get("min_confidence", 0.6),
        rates=rates,
        screenshot_url=payload.get("screenshot_url"),
        raw_html_url=payload.get("raw_html_url"),
        dom_fingerprint=payload.get("dom_fingerprint"),
        layout_fingerprint=strategy.layout_fingerprint,
        extraction_confidence=confidence,
        error_message=payload.get("error_message"),
        diagnostics={
            "target_url": target.url,
            "proxy_assigned": bool(target.proxy_url),
            **payload.get("diagnostics", {}),
        },
    )


def _date_value(value: date | str) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)
