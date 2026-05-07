from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import billing, health, metrics, ops, pms, pricing, properties
from app.config import get_settings
from app.middleware.rate_limit import RedisRateLimitMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RedisRateLimitMiddleware)

    app.include_router(health.router)
    app.include_router(properties.router)
    app.include_router(pms.router)
    app.include_router(pricing.router)
    app.include_router(billing.router)
    app.include_router(ops.router)
    app.include_router(metrics.router)

    return app


app = create_app()
