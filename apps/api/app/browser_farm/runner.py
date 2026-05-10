from __future__ import annotations

import hashlib
import re
from datetime import date, timedelta
from typing import Any

import httpx

from app.agents.types import ExtractedRate, ScrapeExecutionResult, ScrapeTarget, ScraperStrategyPlan
from app.browser_farm.headed import launch_headed_browser
from app.browser_farm.proxy import ProxyLease
from app.browser_farm.stealth import human_scroll, human_type
from app.services.market import normalize_market_target_url


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
        try:
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
        except Exception as exc:
            await session.action_logger.screenshot(session.page, "scrape.exception")
            if "ERR_CERT_AUTHORITY_INVALID" in str(exc):
                session.action_logger.write(
                    "scrape.proxy_tls_error",
                    {
                        "message": "Chrome rejected the residential proxy TLS certificate while loading the OTA page.",
                        "url": session.page.url,
                        "target_url": target.url,
                        "exception_type": type(exc).__name__,
                    },
                )
            session.action_logger.write(
                "scrape.exception",
                {
                    "message": str(exc) or type(exc).__name__,
                    "url": session.page.url,
                    "exception_type": type(exc).__name__,
                },
            )
            raise


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
    navigation_url = normalize_market_target_url(target.url, target.source)
    if navigation_url != target.url:
        diagnostics["normalized_target_url"] = navigation_url
    action_logger = getattr(page, "_rentalradar_action_logger", None)
    try:
        response = await page.goto(navigation_url, wait_until="domcontentloaded", timeout=60_000)
        if response is not None:
            diagnostics["navigation_status"] = response.status
    except Exception as exc:
        blocker = await _detect_navigation_error_page(
            page,
            exception_message=str(exc),
        )
        if blocker is None:
            blocker = await _probe_navigation_blocker(navigation_url, str(exc))
        if blocker:
            diagnostics["blocker"] = blocker
            diagnostics["navigation_error"] = str(exc)
            if action_logger:
                action_logger.write("scrape.blocker_detected", blocker)
            return _blocked_payload(diagnostics, blocker)
        raise
    try:
        await page.wait_for_load_state("networkidle", timeout=10_000)
    except Exception:
        pass
    await page.wait_for_timeout(1_500)
    if action_logger:
        await action_logger.screenshot(page, "scrape.page_loaded")
    await human_scroll(page, min_scrolls=1, max_scrolls=3)
    diagnostics["title"] = await page.title()
    html = await page.content()
    diagnostics["html_sha256"] = hashlib.sha256(html.encode()).hexdigest()
    diagnostics["current_url"] = page.url

    blocker = await _detect_browser_blocker(page, html)
    if blocker:
        diagnostics["blocker"] = blocker
        if action_logger:
            await action_logger.screenshot(page, "scrape.blocker_detected")
            action_logger.write("scrape.blocker_detected", blocker)
        return {
            "rates": [],
            "confidence": 0,
            "diagnostics": diagnostics,
            "dom_fingerprint": diagnostics["html_sha256"][:16],
            "raw_html_url": f"memory://{diagnostics['html_sha256']}",
            "error_message": blocker["message"],
        }

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
    if not diagnostics.get("matched_selector") and action_logger:
        action_logger.write(
            "scrape.selector_missing",
            {
                "message": "Could not find an expected calendar, price, or availability selector.",
                "url": page.url,
                "selectors_checked": selectors[:12],
                "selectors_checked_count": len(selectors),
                "title": diagnostics.get("title"),
            },
        )
        await action_logger.screenshot(page, "scrape.selector_missing")

    rates = await _extract_rates_from_page(page, target, strategy)
    diagnostics["rates_extracted"] = len(rates)
    if not rates and action_logger:
        action_logger.write(
            "scrape.rates_missing",
            {
                "message": "Chrome loaded the OTA page but RentalRadar could not extract any prices from the visible result cards.",
                "url": page.url,
                "matched_selector": diagnostics.get("matched_selector"),
            },
        )

    # The trained extractor is expected to replace this generic rate parser.
    confidence = 0.74 if rates else 0.48 if diagnostics.get("matched_selector") else 0.32
    return {
        "rates": rates,
        "confidence": confidence,
        "diagnostics": diagnostics,
        "dom_fingerprint": diagnostics["html_sha256"][:16],
        "raw_html_url": f"memory://{diagnostics['html_sha256']}",
        "error_message": None if rates else "No visible OTA prices were extracted from the loaded page.",
    }


async def _detect_browser_blocker(page: Any, html: str) -> dict[str, Any] | None:
    title = ""
    body_text = ""
    try:
        title = await page.title()
    except Exception:
        pass
    try:
        body_text = await page.locator("body").inner_text(timeout=2_500)
    except Exception:
        body_text = ""

    return _blocker_from_text(
        title=title,
        body_text=body_text,
        html=html,
        url=page.url,
    )


async def _detect_navigation_error_page(page: Any, *, exception_message: str) -> dict[str, Any] | None:
    if "ERR_HTTP_RESPONSE_CODE_FAILURE" not in exception_message:
        return None
    title = ""
    body_text = ""
    html = ""
    try:
        title = await page.title()
    except Exception:
        pass
    try:
        body_text = await page.locator("body").inner_text(timeout=1_500)
    except Exception:
        pass
    try:
        html = await page.content()
    except Exception:
        pass
    if not title and not body_text and not html:
        return None
    return _blocker_from_text(
        title=title,
        body_text=body_text,
        html=html,
        url=page.url,
    )


async def _probe_navigation_blocker(url: str, exception_message: str) -> dict[str, Any] | None:
    if "ERR_HTTP_RESPONSE_CODE_FAILURE" not in exception_message:
        return None
    headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
    except httpx.HTTPError:
        return None

    title_match = re.search(r"<title[^>]*>(.*?)</title>", response.text, flags=re.IGNORECASE | re.DOTALL)
    title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
    return _blocker_from_text(
        title=title,
        body_text="",
        html=response.text,
        url=str(response.url),
        status=response.status_code,
    )


def _blocker_from_text(
    *,
    title: str,
    body_text: str,
    html: str,
    url: str,
    status: int | None = None,
) -> dict[str, Any] | None:
    haystack = f"{status or ''}\n{title}\n{body_text[:5000]}\n{html[:5000]}".lower()
    checks = [
        ("proxy_auth_required", ["proxy authentication required", "http error 407", "\n407\n"]),
        ("captcha", ["captcha", "recaptcha", "hcaptcha", "verify you are human", "human verification"]),
        (
            "bot_challenge",
            [
                "bot or not",
                "datadome-challenge",
                "arkose",
                "unusual traffic",
                "automated access",
                "are you a robot",
                "robot check",
                "security check",
            ],
        ),
        ("access_denied", ["access denied", "forbidden", "request blocked", "temporarily blocked"]),
        ("login_wall", ["sign in to continue", "log in to continue", "create an account to continue"]),
        ("rate_limited", ["429", "too many requests", "rate limit", "try again later"]),
    ]
    for kind, needles in checks:
        matched = next((needle for needle in needles if needle in haystack), None)
        if matched:
            message = (
                "Chrome could not authenticate with the residential proxy. Check the proxy server, username, and password."
                if kind == "proxy_auth_required"
                else f"Chrome hit a {kind.replace('_', ' ')} while loading the OTA page."
            )
            return {
                "kind": kind,
                "message": message,
                "matched_text": matched,
                "url": url,
                "title": title,
                "http_status": status,
            }
    return None


def _blocked_payload(diagnostics: dict[str, Any], blocker: dict[str, Any]) -> dict[str, Any]:
    fingerprint = hashlib.sha256(repr(blocker).encode()).hexdigest()
    return {
        "rates": [],
        "confidence": 0,
        "diagnostics": diagnostics,
        "dom_fingerprint": fingerprint[:16],
        "raw_html_url": f"memory://{fingerprint}",
        "error_message": blocker["message"],
    }


async def _extract_rates_from_page(page: Any, target: ScrapeTarget, strategy: ScraperStrategyPlan) -> list[dict[str, Any]]:
    selectors = _price_selectors(strategy)
    seen: set[int] = set()
    extracted: list[dict[str, Any]] = []
    stay_nights = max(1, (target.stay_date_end - target.stay_date_start).days + 1)
    validators = strategy.strategy_json.get("validators", {})
    min_cents = int(validators.get("nightly_rate_min_cents", 2000))
    max_cents = int(validators.get("nightly_rate_max_cents", 500000))

    for selector in selectors:
        try:
            locator = page.locator(selector)
            count = min(await locator.count(), 12)
        except Exception:
            continue
        for index in range(count):
            try:
                text = await locator.nth(index).inner_text(timeout=1_500)
            except Exception:
                continue
            price_cents = _price_cents_from_text(text)
            if price_cents is None or price_cents in seen:
                continue
            seen.add(price_cents)
            lower = text.lower()
            looks_nightly = any(marker in lower for marker in ("per night", "/night", "nightly"))
            total_rate_cents = None if looks_nightly else price_cents
            nightly_rate_cents = price_cents if looks_nightly else max(1, round(price_cents / stay_nights))
            if nightly_rate_cents < min_cents or nightly_rate_cents > max_cents:
                continue
            for offset in range(stay_nights):
                extracted.append(
                    {
                        "stay_date": (target.stay_date_start + timedelta(days=offset)).isoformat(),
                        "nightly_rate_cents": nightly_rate_cents,
                        "total_rate_cents": total_rate_cents if offset == 0 else None,
                        "available": True,
                        "min_nights": stay_nights,
                        "raw_payload": {
                            "source": target.source.value,
                            "selector": selector,
                            "text": text[:500],
                            "assumed_total_rate": not looks_nightly,
                        },
                    }
                )
            if len(extracted) >= 28:
                return extracted[:28]

    return extracted[:28]


def _price_selectors(strategy: ScraperStrategyPlan) -> list[str]:
    selectors: list[str] = []
    for step in strategy.strategy_json.get("steps", []):
        if step.get("action") == "extract_rates":
            selectors.extend(step.get("price_selectors", []))
            for result_selector in step.get("result_selectors", []):
                selectors.append(f"{result_selector} [data-testid*='price' i]")
                selectors.append(f"{result_selector} [class*='price' i]")
    selectors.extend(
        [
            "[data-testid='price-and-discounted-price']",
            "[data-testid='price-availability-row']",
            "[data-stid*='price' i]",
            "[aria-label*='price' i]",
            "[aria-label*='total' i]",
            "[class*='price' i]",
        ]
    )
    return list(dict.fromkeys(selectors))


def _price_cents_from_text(text: str) -> int | None:
    normalized = " ".join(text.split())
    matches = re.findall(r"(?:US\$|\$)\s*([0-9][0-9,]*(?:\.\d{2})?)", normalized)
    if not matches:
        matches = re.findall(r"([0-9][0-9,]*(?:\.\d{2})?)\s*(?:USD|US dollars)", normalized, flags=re.IGNORECASE)
    if not matches:
        return None
    values = [int(float(match.replace(",", "")) * 100) for match in matches]
    return max(values)


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
