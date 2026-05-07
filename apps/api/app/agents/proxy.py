from __future__ import annotations

from itertools import cycle

from app.config import get_settings


class ProxyRotator:
    def __init__(self, proxies: list[str] | None = None) -> None:
        self.proxies = proxies if proxies is not None else get_settings().scraper_proxy_urls
        self._cycle = cycle(self.proxies) if self.proxies else None

    def next_proxy(self) -> str | None:
        if self._cycle is None:
            return None
        return next(self._cycle)
