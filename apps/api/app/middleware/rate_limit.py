from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.config import get_settings
from app.services.cache import get_redis


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window API rate limit using Redis with fail-open behavior."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()
        if settings.api_rate_limit_per_minute <= 0 or request.url.path in {"/health", "/webhooks/stripe"}:
            return await call_next(request)

        org_id = request.headers.get("x-organization-id")
        client_ip = request.client.host if request.client else "unknown"
        key_subject = org_id or client_ip
        key = f"rate-limit:{key_subject}:{request.url.path}"

        try:
            redis = get_redis()
            count = redis.incr(key)
            if count == 1:
                redis.expire(key, 60)
            ttl = max(redis.ttl(key), 0)
            remaining = max(settings.api_rate_limit_per_minute - int(count), 0)
            if count > settings.api_rate_limit_per_minute:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Retry after the current one-minute window.",
                        "retry_after_seconds": ttl,
                    },
                    headers={
                        "Retry-After": str(ttl),
                        "X-RateLimit-Limit": str(settings.api_rate_limit_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(ttl),
                    },
                )
        except Exception:
            response = await call_next(request)
            response.headers["X-RateLimit-Bypass"] = "redis_unavailable"
            return response

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.api_rate_limit_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(ttl)
        return response
