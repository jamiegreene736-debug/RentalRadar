from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote, urlsplit, urlunsplit

from redis import Redis

from app.config import get_settings
from app.services.cache import get_redis


@dataclass(frozen=True)
class ProxyLease:
    server: str
    username: str | None = None
    password: str | None = None
    provider: str | None = None
    sticky_session_id: str | None = None

    def as_playwright_proxy(self) -> dict[str, str]:
        proxy = {"server": self.server}
        if self.username:
            proxy["username"] = self.username
        if self.password:
            proxy["password"] = self.password
        return proxy

    def redacted(self) -> dict[str, Any]:
        return {
            "server": self.server,
            "username": self.username,
            "provider": self.provider,
            "sticky_session_id": self.sticky_session_id,
            "password": "***" if self.password else None,
        }


class ProxyRotator:
    """Rotates residential proxies from Redis first, then env config.

    Redis pool format:
      RPUSH rentalradar:proxy_pool '{"server":"http://host:port","username":"u","password":"p","provider":"oxylabs"}'
    """

    def __init__(self, redis_client: Redis | None = None) -> None:
        self.settings = get_settings()
        self.redis = redis_client or get_redis()

    def lease(self, job_id: str | None = None) -> ProxyLease | None:
        redis_proxy = self._lease_from_redis(job_id)
        if redis_proxy:
            return redis_proxy
        brightdata_proxy = self._lease_from_brightdata(job_id)
        if brightdata_proxy:
            return brightdata_proxy
        if not self.settings.scraper_proxy_urls:
            if self.settings.scraper_require_residential_proxy:
                raise RuntimeError(
                    "Residential proxy required but not configured. Set Bright Data proxy variables or SCRAPER_PROXY_URLS."
                )
            return None
        server = random.choice(self.settings.scraper_proxy_urls)
        return _lease_from_proxy_url(server, provider="env")

    def mark_success(self, lease: ProxyLease | None) -> None:
        if not lease:
            return
        self.redis.hincrby("rentalradar:proxy:success", lease.server, 1)

    def mark_failure(self, lease: ProxyLease | None, reason: str) -> None:
        if not lease:
            return
        self.redis.hincrby("rentalradar:proxy:failure", lease.server, 1)
        self.redis.hset(
            "rentalradar:proxy:last_failure",
            lease.server,
            json.dumps({"reason": reason, "at": datetime.now(timezone.utc).isoformat()}),
        )
        self.redis.setex(
            f"rentalradar:proxy:cooldown:{lease.server}",
            self.settings.scraper_proxy_cooldown_seconds,
            reason,
        )

    def _lease_from_redis(self, job_id: str | None) -> ProxyLease | None:
        key = self.settings.scraper_proxy_redis_key
        pool_size = self.redis.llen(key)
        for _ in range(int(pool_size or 0)):
            raw = self.redis.lpop(key)
            if raw is None:
                return None
            self.redis.rpush(key, raw)
            data = json.loads(raw)
            server = data["server"]
            if self.redis.exists(f"rentalradar:proxy:cooldown:{server}"):
                continue
            return ProxyLease(
                server=server,
                username=data.get("username"),
                password=data.get("password"),
                provider=data.get("provider"),
                sticky_session_id=data.get("sticky_session_id") or job_id,
            )
        return None

    def _lease_from_brightdata(self, job_id: str | None) -> ProxyLease | None:
        if not self.settings.brightdata_proxy_server:
            return None
        lease = _lease_from_proxy_url(self.settings.brightdata_proxy_server, provider="brightdata")
        username = self.settings.brightdata_proxy_username or lease.username
        password = self.settings.brightdata_proxy_password or lease.password
        if username and "{session}" in username:
            username = username.replace("{session}", _session_token(job_id))
        return ProxyLease(
            server=lease.server,
            username=username,
            password=password,
            provider="brightdata",
            sticky_session_id=_session_token(job_id),
        )


def _lease_from_proxy_url(value: str, provider: str) -> ProxyLease:
    parsed = urlsplit(value)
    if not parsed.username and not parsed.password:
        return ProxyLease(server=value, provider=provider)
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    server = urlunsplit((parsed.scheme, host, parsed.path, parsed.query, parsed.fragment))
    return ProxyLease(
        server=server,
        username=unquote(parsed.username) if parsed.username else None,
        password=unquote(parsed.password) if parsed.password else None,
        provider=provider,
    )


def _session_token(job_id: str | None) -> str:
    token = (job_id or "rentalradar").replace("-", "")[:18]
    return f"rr{token}"
