from __future__ import annotations

import asyncio
from datetime import date
from string import Template

from app.agents.orchestrator import MarketScrapeOrchestrator
from app.agents.proxy import ProxyRotator
from app.agents.types import ScrapeTarget
from app.config import get_settings
from app.db.models import ScrapeSource
from app.integrations.types import (
    ChannelPropertyRef,
    ChannelRate,
    ChannelRateUpdate,
    ConnectorCredentials,
    ConnectorError,
    ConnectorResult,
)


class AdaptivePlaywrightPmsFallback:
    def __init__(self, credentials: ConnectorCredentials, metadata: dict | None = None) -> None:
        self.credentials = credentials
        self.metadata = metadata or {}

    def pull_rates(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> list[ChannelRate]:
        target_url = self.metadata.get("direct_site_url") or self.metadata.get("calendar_url")
        if not target_url:
            raise ConnectorError("Playwright fallback requires direct_site_url or calendar_url metadata")
        target = ScrapeTarget(
            source=ScrapeSource.direct_pms,
            url=target_url.format(property_id=property_ref.external_property_id),
            stay_date_start=start_date,
            stay_date_end=end_date,
            proxy_url=ProxyRotator().next_proxy(),
        )
        result = asyncio.run(MarketScrapeOrchestrator().run(target)).result
        if not result.success:
            raise ConnectorError(result.error_message or "playwright_fallback_failed")
        return [
            ChannelRate(
                stay_date=rate.stay_date,
                rate_cents=rate.nightly_rate_cents,
                available=rate.available,
                min_stay=rate.min_nights,
                raw_payload=rate.raw_payload | {"fallback": "adaptive_playwright"},
            )
            for rate in result.rates
        ]

    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        strategy = self.metadata.get("playwright_push_strategy")
        if not strategy:
            raise ConnectorError("Playwright push fallback requires a reviewed playwright_push_strategy")
        if not self.credentials.username and not self.credentials.access_token:
            raise ConnectorError("Playwright push fallback requires encrypted login credentials")
        if get_settings().environment == "local" and self.metadata.get("simulate_playwright_push"):
            return ConnectorResult(
                provider=self.credentials.provider,
                status="succeeded",
                response={
                    "mode": "adaptive_playwright_simulation",
                    "strategy_version": strategy.get("version", 1),
                    "property_id": property_ref.external_property_id,
                    "updates": len(updates),
                },
                fallback_used=True,
            )

        asyncio.run(self._execute_push_strategy(property_ref, updates, strategy))
        return ConnectorResult(
            provider=self.credentials.provider,
            status="succeeded",
            response={
                "mode": "adaptive_playwright",
                "strategy_version": strategy.get("version", 1),
                "property_id": property_ref.external_property_id,
                "updates": len(updates),
            },
            fallback_used=True,
        )

    async def _execute_push_strategy(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
        strategy: dict,
    ) -> None:
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise ConnectorError("Playwright is required for direct PMS push fallback") from exc

        settings = get_settings()
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=settings.scraper_headless)
            context = await browser.new_context()
            page = await context.new_page()
            try:
                for action in strategy.get("login", []):
                    await self._run_action(page, action, property_ref, None)
                for update in updates:
                    for action in strategy.get("update_rate", []):
                        await self._run_action(page, action, property_ref, update)
            finally:
                await browser.close()

    async def _run_action(self, page, action: dict, property_ref: ChannelPropertyRef, update: ChannelRateUpdate | None) -> None:
        values = {
            "username": self.credentials.username or "",
            "password": self.credentials.password or "",
            "access_token": self.credentials.access_token or "",
            "property_id": property_ref.external_property_id,
            "date": update.stay_date.isoformat() if update else "",
            "rate": str(round(update.rate_cents / 100, 2)) if update else "",
            "rate_cents": str(update.rate_cents) if update else "",
            "min_stay": str(update.min_stay or "") if update else "",
        }
        kind = action.get("action")
        selector = render_template(action.get("selector"), values)
        value = render_template(action.get("value"), values)
        if kind == "goto":
            await page.goto(render_template(action["url"], values), wait_until=action.get("wait_until", "domcontentloaded"))
        elif kind == "fill":
            await page.fill(selector, value)
        elif kind == "click":
            await page.click(selector)
        elif kind == "press":
            await page.press(selector, value)
        elif kind == "wait_for":
            await page.wait_for_selector(selector, timeout=action.get("timeout_ms", 15000))
        elif kind == "select_option":
            await page.select_option(selector, value)
        else:
            raise ConnectorError(f"Unsupported Playwright fallback action: {kind}")


def render_template(value: str | None, mapping: dict[str, str]) -> str:
    if value is None:
        return ""
    return Template(value).safe_substitute(mapping)
