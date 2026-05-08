from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RentalRadar API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    token_encryption_key: str = "dev-only-replace-me"
    ota_direct_master_secret: str = "dev-only-direct-ota-replace-me"
    ota_2fa_wait_seconds: int = 600
    ota_notification_email_from: str = "security@rentalradar.ai"
    scraper_proxy_urls: list[str] = Field(default_factory=list)
    scraper_proxy_redis_key: str = "rentalradar:proxy_pool"
    scraper_proxy_cooldown_seconds: int = 120
    browser_worker_max_concurrent_browsers: int = 4
    browser_worker_metrics_port: int = 9108
    browser_action_log_dir: str = "/tmp/rentalradar/browser-actions"
    scraper_allow_deterministic_fallback: bool = False
    llm_provider: str = "stub"
    openai_api_key: str | None = None
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_starter: str | None = None
    stripe_price_growth: str | None = None
    stripe_price_pro: str | None = None
    app_base_url: str = "http://localhost:3000"
    api_rate_limit_per_minute: int = 120
    free_tier_property_limit: int = 1
    default_market_scan_days: int = 90
    default_comp_limit: int = 12
    integration_http_timeout_seconds: float = 30.0
    integration_max_retries: int = 3
    scraper_headless: bool = False
    scraper_stealth: bool = True
    cors_origins: list[AnyHttpUrl] | list[str] = Field(default_factory=lambda: ["*"])

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Rewrite the DATABASE_URL dialect to psycopg (psycopg3).

        Railway and many tooling defaults emit ``postgresql://`` or
        ``postgresql+psycopg2://``.  Both resolve to the legacy psycopg2
        driver which is not installed.  Convert them to
        ``postgresql+psycopg://`` so SQLAlchemy uses the psycopg3 driver
        declared in pyproject.toml (``psycopg[binary]>=3.2``).
        """
        for prefix in ("postgresql+psycopg2://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @field_validator("scraper_proxy_urls", mode="before")
    @classmethod
    def parse_proxy_urls(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def default_celery_to_redis(self) -> Settings:
        if self.celery_broker_url is None:
            self.celery_broker_url = self.redis_url
        if self.celery_result_backend is None:
            self.celery_result_backend = self.redis_url
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
