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
    scraper_require_residential_proxy: bool = False
    scraper_allow_direct_fallback_on_proxy_failure: bool = True
    brightdata_proxy_server: str | None = None
    brightdata_proxy_scheme: str = "http"
    brightdata_proxy_host: str | None = None
    brightdata_proxy_port: int | None = None
    brightdata_proxy_username: str | None = None
    brightdata_proxy_password: str | None = None
    browser_worker_max_concurrent_browsers: int = 4
    browser_worker_metrics_port: int = 9108
    browser_action_log_dir: str = "/tmp/rentalradar/browser-actions"
    scraper_allow_deterministic_fallback: bool = False
    llm_provider: str = "stub"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 8.0
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
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
    market_booked_data_provider: str = "none"
    airroi_api_key: str | None = None
    airroi_base_url: str = "https://api.airroi.com"
    airroi_radius_miles: float = 5.0
    airroi_page_size: int = 50
    demand_signals_auto_refresh_enabled: bool = True
    demand_signal_http_timeout_seconds: float = 12.0
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    ticketmaster_api_key: str | None = None
    ticketmaster_base_url: str = "https://app.ticketmaster.com/discovery/v2"
    ticketmaster_event_radius_miles: int = 35
    flight_demand_provider: str = "none"
    flight_demand_default_airport_iata: str | None = None
    flight_demand_busy_arrivals_per_day: int = 90
    flight_demand_max_days: int = 30
    aviationstack_api_key: str | None = None
    aviationstack_base_url: str = "https://api.aviationstack.com/v1"
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
                return "postgresql+psycopg://" + value[len(prefix) :]
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
        if self.brightdata_proxy_server is None and self.brightdata_proxy_host:
            host = self.brightdata_proxy_host
            if self.brightdata_proxy_port is not None and ":" not in host.rsplit("@", 1)[-1]:
                host = f"{host}:{self.brightdata_proxy_port}"
            self.brightdata_proxy_server = f"{self.brightdata_proxy_scheme}://{host}"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
