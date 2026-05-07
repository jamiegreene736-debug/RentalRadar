from __future__ import annotations

import json
from typing import Any

from redis import Redis

from app.config import get_settings


def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


class JsonCache:
    def __init__(self, redis_client: Redis | None = None) -> None:
        self.redis = redis_client or get_redis()

    def get(self, key: str) -> dict[str, Any] | list[Any] | None:
        value = self.redis.get(key)
        if not value:
            return None
        return json.loads(value)

    def set(self, key: str, value: dict[str, Any] | list[Any], ttl_seconds: int) -> None:
        self.redis.setex(key, ttl_seconds, json.dumps(value, default=str))

    def delete(self, key: str) -> None:
        self.redis.delete(key)
