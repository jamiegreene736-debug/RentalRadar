from __future__ import annotations

import asyncio
import os
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from app.browser_farm.action_logger import BrowserActionLogger
from app.browser_farm.proxy import ProxyLease
from app.browser_farm.stealth import apply_stealth_patches, humanize_page, random_fingerprint
from app.config import get_settings


_browser_slots: asyncio.Semaphore | None = None


def browser_slots() -> asyncio.Semaphore:
    global _browser_slots
    if _browser_slots is None:
        _browser_slots = asyncio.Semaphore(get_settings().browser_worker_max_concurrent_browsers)
    return _browser_slots


@dataclass
class HeadedBrowserSession:
    playwright: Playwright
    browser: Browser
    context: BrowserContext
    page: Page
    user_data_dir: str
    action_logger: BrowserActionLogger
    proxy: ProxyLease | None


@asynccontextmanager
async def launch_headed_browser(
    *,
    job_id: str,
    proxy: ProxyLease | None = None,
    proxy_url: str | None = None,
    user_agent: str | None = None,
    storage_state: dict | None = None,
) -> AsyncIterator[HeadedBrowserSession]:
    """Launch real headed Google Chrome/Chromium inside Xvfb.

    `headless=False` is non-negotiable. The container entrypoint must provide a
    DISPLAY, normally via `xvfb-run`, so Chrome renders as if a real monitor exists.
    """

    settings = get_settings()
    if settings.scraper_headless:
        raise RuntimeError("SCRAPER_HEADLESS must remain false for RentalRadar browser workers")
    if not os.environ.get("DISPLAY"):
        raise RuntimeError("DISPLAY is missing. Start browser workers with xvfb-run or pyvirtualdisplay.")

    await browser_slots().acquire()
    playwright = await async_playwright().start()
    browser: Browser | None = None
    context: BrowserContext | None = None
    screenshot_heartbeat: asyncio.Task[None] | None = None
    user_data_dir = tempfile.mkdtemp(prefix=f"rr-browser-{job_id}-")
    action_logger = BrowserActionLogger(job_id)
    profile = random_fingerprint()
    if user_agent:
        profile = type(profile)(
            user_agent=user_agent,
            locale=profile.locale,
            timezone_id=profile.timezone_id,
            viewport=profile.viewport,
            hardware_concurrency=profile.hardware_concurrency,
            device_memory=profile.device_memory,
            languages=profile.languages,
            webgl_vendor=profile.webgl_vendor,
            webgl_renderer=profile.webgl_renderer,
        )
    proxy = proxy or (ProxyLease(server=proxy_url) if proxy_url else None)

    try:
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--start-maximized",
            "--disable-infobars",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-first-run",
            "--no-default-browser-check",
            "--password-store=basic",
            "--use-mock-keychain",
            f"--window-size={profile.viewport['width']},{profile.viewport['height']}",
        ]
        launch_kwargs = {
            "headless": False,
            "channel": "chrome",
            "args": launch_args,
            "ignore_default_args": ["--enable-automation"],
            "timeout": 90_000,
        }
        if proxy:
            launch_kwargs["proxy"] = proxy.as_playwright_proxy()

        try:
            browser = await playwright.chromium.launch(**launch_kwargs)
        except Exception:
            launch_kwargs.pop("channel", None)
            browser = await playwright.chromium.launch(**launch_kwargs)

        context = await browser.new_context(
            user_agent=profile.user_agent,
            viewport=profile.viewport,
            locale=profile.locale,
            timezone_id=profile.timezone_id,
            color_scheme="light",
            storage_state=storage_state,
            java_script_enabled=True,
            ignore_https_errors=False,
        )
        await apply_stealth_patches(context, profile)
        page = await context.new_page()
        await action_logger.attach(page)
        setattr(page, "_rentalradar_action_logger", action_logger)
        action_logger.write("browser.launched", {"proxy": proxy.redacted() if proxy else None, "profile": profile})
        await action_logger.screenshot(page, "scrape.live_screenshot")
        screenshot_heartbeat = action_logger.start_screenshot_heartbeat(page)
        await humanize_page(page)
        yield HeadedBrowserSession(
            playwright=playwright,
            browser=browser,
            context=context,
            page=page,
            user_data_dir=user_data_dir,
            action_logger=action_logger,
            proxy=proxy,
        )
    finally:
        if screenshot_heartbeat:
            screenshot_heartbeat.cancel()
            try:
                await screenshot_heartbeat
            except asyncio.CancelledError:
                pass
        action_logger.write("browser.shutdown")
        try:
            if context:
                await context.close()
        finally:
            try:
                if browser:
                    await browser.close()
            finally:
                await playwright.stop()
                _cleanup_dir(user_data_dir)
                browser_slots().release()


def _cleanup_dir(path: str) -> None:
    root = Path(path)
    if not root.exists():
        return
    for child in sorted(root.rglob("*"), reverse=True):
        try:
            if child.is_file() or child.is_symlink():
                child.unlink()
            elif child.is_dir():
                child.rmdir()
        except OSError:
            pass
    try:
        root.rmdir()
    except OSError:
        pass
