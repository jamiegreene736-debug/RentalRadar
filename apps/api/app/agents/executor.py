from __future__ import annotations

import hashlib
import random
from uuid import uuid4
from datetime import timedelta

from app.agents.types import ExtractedRate, ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan
from app.browser_farm.proxy import ProxyRotator
from app.browser_farm.runner import run_trained_scraping_script
from app.config import get_settings


class ScraperExecutorAgent:
    """Runs trained Playwright code in real headed Chrome through the browser farm.

    The deterministic fallback produces realistic-looking observations for
    tests only when explicitly enabled. Production must run headed Chrome with
    `headless=False` under Xvfb.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def execute(
        self,
        target: ScrapeTarget,
        strategy: ScraperStrategyPlan,
    ) -> ScrapeExecutionResult:
        try:
            return await self._execute_with_playwright(target, strategy)
        except Exception as exc:
            return ScrapeExecutionResult(
                success=False,
                error_message=str(exc),
                layout_fingerprint=strategy.layout_fingerprint,
                diagnostics={"strategy": strategy.strategy_json},
            )

    async def _execute_with_playwright(
        self,
        target: ScrapeTarget,
        strategy: ScraperStrategyPlan,
    ) -> ScrapeExecutionResult:
        if self.settings.scraper_allow_deterministic_fallback:
            return self._fallback_result(target, strategy, "explicit_deterministic_fallback")
        job_id = target.browser_session_id or str(uuid4())
        proxy_rotator = ProxyRotator()
        proxy_lease = proxy_rotator.lease(job_id=job_id)
        target = ScrapeTarget(
            source=target.source,
            url=target.url,
            stay_date_start=target.stay_date_start,
            stay_date_end=target.stay_date_end,
            proxy_url=proxy_lease.server if proxy_lease else None,
            browser_session_id=job_id,
        )
        try:
            result = await run_trained_scraping_script(
                job_id=job_id,
                target=target,
                strategy=strategy,
                proxy=proxy_lease,
            )
            if result.success:
                proxy_rotator.mark_success(proxy_lease)
            else:
                proxy_rotator.mark_failure(proxy_lease, result.error_message or "low_confidence")
            return result
        except Exception as exc:
            proxy_rotator.mark_failure(proxy_lease, str(exc))
            raise

    def _fallback_result(
        self,
        target: ScrapeTarget,
        strategy: ScraperStrategyPlan,
        mode: str,
    ) -> ScrapeExecutionResult:
        seed = hashlib.sha256(f"{target.source.value}:{target.url}".encode()).hexdigest()
        rng = random.Random(int(seed[:12], 16))
        rates: list[ExtractedRate] = []
        current = target.stay_date_start
        while current <= target.stay_date_end:
            base = 12500 + rng.randint(0, 24000)
            weekend = current.weekday() in (4, 5)
            rate = int(base * (1.18 if weekend else 1.0))
            rates.append(
                ExtractedRate(
                    stay_date=current,
                    nightly_rate_cents=rate,
                    total_rate_cents=rate + 2500,
                    available=rng.random() > 0.18,
                    min_nights=2 if weekend else 1,
                    raw_payload={"mode": mode, "source_url": target.url},
                )
            )
            current += timedelta(days=1)
        return ScrapeExecutionResult(
            success=True,
            rates=rates,
            dom_fingerprint=seed[:16],
            layout_fingerprint=strategy.layout_fingerprint,
            extraction_confidence=0.78,
            diagnostics={"mode": mode, "proxy_url": target.proxy_url},
        )
