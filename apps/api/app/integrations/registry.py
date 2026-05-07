from __future__ import annotations

from app.db.models import PmsProvider
from app.integrations.base import BaseChannelConnector
from app.integrations.fallback import AdaptivePlaywrightPmsFallback
from app.integrations.providers import (
    AirbnbPartnerConnector,
    BookingConnectivityConnector,
    DirectSiteConnector,
    GuestyConnector,
    HostawayConnector,
    HostfullyConnector,
    LodgifyConnector,
    OwnerRezConnector,
    VrboPartnerConnector,
)
from app.integrations.types import ConnectorCredentials


class ChannelConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: dict[PmsProvider, type[BaseChannelConnector]] = {
            PmsProvider.guesty: GuestyConnector,
            PmsProvider.hostaway: HostawayConnector,
            PmsProvider.lodgify: LodgifyConnector,
            PmsProvider.ownerrez: OwnerRezConnector,
            PmsProvider.hostfully: HostfullyConnector,
            PmsProvider.booking: BookingConnectivityConnector,
            PmsProvider.airbnb: AirbnbPartnerConnector,
            PmsProvider.vrbo: VrboPartnerConnector,
            PmsProvider.direct: DirectSiteConnector,
            PmsProvider.other: DirectSiteConnector,
        }

    def connector_for(
        self,
        credentials: ConnectorCredentials,
        metadata: dict | None = None,
    ) -> BaseChannelConnector:
        connector_cls = self._connectors.get(credentials.provider)
        if connector_cls is None:
            raise ValueError(f"No connector registered for {credentials.provider.value}")
        return connector_cls(credentials, metadata)

    def playwright_fallback(
        self,
        credentials: ConnectorCredentials,
        metadata: dict | None = None,
    ) -> AdaptivePlaywrightPmsFallback:
        return AdaptivePlaywrightPmsFallback(credentials, metadata)
