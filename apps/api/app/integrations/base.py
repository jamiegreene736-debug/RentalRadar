from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from app.db.models import PmsProvider
from app.integrations.types import (
    ChannelPropertyRef,
    ChannelRate,
    ChannelRateUpdate,
    ConnectorCredentials,
    ConnectorResult,
    ProviderCapabilities,
)


class BaseChannelConnector(ABC):
    provider: PmsProvider
    capabilities: ProviderCapabilities

    def __init__(self, credentials: ConnectorCredentials, metadata: dict | None = None) -> None:
        self.credentials = credentials
        self.metadata = metadata or {}

    @abstractmethod
    def pull_rates(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> list[ChannelRate]:
        raise NotImplementedError

    @abstractmethod
    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        raise NotImplementedError

    def pull_reservations(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> ConnectorResult:
        return ConnectorResult(
            provider=self.provider,
            status="skipped",
            skipped_reason="reservation pull not implemented for this connector yet",
        )

    def test_connection(self) -> ConnectorResult:
        return ConnectorResult(
            provider=self.provider,
            status="succeeded",
            response={"mode": "connector_default_validation"},
        )
