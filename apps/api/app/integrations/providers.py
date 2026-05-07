from __future__ import annotations

import base64
import hashlib
from datetime import date
from uuid import uuid4

from app.db.models import PmsProvider
from app.integrations.base import BaseChannelConnector
from app.integrations.http import IntegrationHttpClient
from app.integrations.types import (
    ChannelPropertyRef,
    ChannelRate,
    ChannelRateUpdate,
    ConnectorResult,
    CredentialError,
    PartnerAccessRequired,
    ProviderCapabilities,
)


class JsonCalendarConnector(BaseChannelConnector):
    base_url: str
    rates_path_template: str
    push_path_template: str
    auth_style = "bearer"

    def _client(self) -> IntegrationHttpClient:
        token = self.credentials.access_token or self.credentials.api_key
        if not token:
            raise CredentialError(f"{self.provider.value} requires an access token or API key")
        headers = {"Accept": "application/json"}
        if self.auth_style == "x-api-key":
            headers["X-Api-Key"] = token
        else:
            headers["Authorization"] = f"Bearer {token}"
        return IntegrationHttpClient(self.metadata.get("base_url", self.base_url), headers=headers)

    def pull_rates(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> list[ChannelRate]:
        path = self.metadata.get("rates_path_template", self.rates_path_template).format(
            property_id=property_ref.external_property_id
        )
        payload = self._client().request(
            "GET",
            path,
            params={"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
        )
        return normalize_rate_payload(payload)

    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        path = self.metadata.get("push_path_template", self.push_path_template).format(
            property_id=property_ref.external_property_id
        )
        body = {
            "propertyId": property_ref.external_property_id,
            "rates": [rate_update_payload(update) for update in updates],
        }
        response = self._client().request("PUT", path, json=body)
        return ConnectorResult(
            provider=self.provider,
            status="succeeded",
            external_request_id=response.get("requestId") or f"rr_{uuid4()}",
            response=response,
        )


class GuestyConnector(JsonCalendarConnector):
    provider = PmsProvider.guesty
    base_url = "https://open-api.guesty.com/v1"
    rates_path_template = "/listings/{property_id}/calendar"
    push_path_template = "/listings/{property_id}/calendar"
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        supports_playwright_fallback=True,
    )


class HostawayConnector(JsonCalendarConnector):
    provider = PmsProvider.hostaway
    base_url = "https://api.hostaway.com/v1"
    rates_path_template = "/listings/{property_id}/calendar"
    push_path_template = "/listings/{property_id}/calendar"
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        supports_playwright_fallback=True,
    )


class LodgifyConnector(JsonCalendarConnector):
    provider = PmsProvider.lodgify
    base_url = "https://api.lodgify.com/v2"
    auth_style = "x-api-key"
    rates_path_template = "/properties/{property_id}/calendar"
    push_path_template = "/properties/{property_id}/calendar"
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        supports_playwright_fallback=True,
    )


class OwnerRezConnector(JsonCalendarConnector):
    provider = PmsProvider.ownerrez
    base_url = "https://api.ownerrez.com/v2"
    rates_path_template = "/properties/{property_id}/availability"
    push_path_template = "/properties/{property_id}/rates"
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        supports_playwright_fallback=True,
    )


class HostfullyConnector(JsonCalendarConnector):
    provider = PmsProvider.hostfully
    base_url = "https://api.hostfully.com/v1"
    rates_path_template = "/properties/{property_id}/calendar"
    push_path_template = "/properties/{property_id}/calendar"
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        supports_playwright_fallback=True,
    )


class BookingConnectivityConnector(BaseChannelConnector):
    provider = PmsProvider.booking
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        ota_direct=True,
        requires_partner_certification=True,
    )

    def pull_rates(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> list[ChannelRate]:
        endpoint = self.metadata.get("room_rate_availability_endpoint")
        if not endpoint:
            raise PartnerAccessRequired("Booking.com roomRateAvailability endpoint requires Connectivity Partner setup")
        response = self._client().request(
            "GET",
            endpoint,
            params={"hotel_id": property_ref.external_property_id, "date_from": start_date.isoformat(), "date_to": end_date.isoformat()},
        )
        return normalize_rate_payload(response)

    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        room_id = property_ref.external_channel_ids.get("booking_room_id")
        rate_id = property_ref.external_channel_ids.get("booking_rate_id")
        if not room_id or not rate_id:
            raise PartnerAccessRequired("Booking.com direct push requires room ID and rate ID mapping")
        xml = booking_availability_xml(property_ref.external_property_id, str(room_id), str(rate_id), updates)
        response = self._client().request("POST", "/hotels/xml/availability", content=xml, headers={"Content-Type": "text/xml"})
        return ConnectorResult(
            provider=self.provider,
            status="succeeded",
            external_request_id=response.get("request_id") or f"booking_{hashlib.sha1(xml.encode()).hexdigest()[:10]}",
            response=response,
        )

    def _client(self) -> IntegrationHttpClient:
        if not self.credentials.username or not self.credentials.password:
            raise CredentialError("Booking.com Connectivity requires username/password or configured auth proxy")
        auth = base64.b64encode(f"{self.credentials.username}:{self.credentials.password}".encode()).decode()
        return IntegrationHttpClient(
            self.metadata.get("base_url", "https://supply-xml.booking.com"),
            headers={"Authorization": self.metadata.get("authorization", f"Basic {auth}")},
        )


class PartnerOtaConnector(BaseChannelConnector):
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=True,
        pull_reservations=True,
        ota_direct=True,
        requires_partner_certification=True,
    )

    def pull_rates(
        self,
        property_ref: ChannelPropertyRef,
        start_date: date,
        end_date: date,
    ) -> list[ChannelRate]:
        endpoint = self.metadata.get("partner_rates_endpoint")
        if not endpoint:
            raise PartnerAccessRequired(f"{self.provider.value} direct API access requires partner/channel-manager credentials")
        payload = self._client().request(
            "GET",
            endpoint.format(property_id=property_ref.external_property_id),
            params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        )
        return normalize_rate_payload(payload)

    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        endpoint = self.metadata.get("partner_rates_endpoint")
        if not endpoint:
            raise PartnerAccessRequired(f"{self.provider.value} direct API push requires certified partner access")
        response = self._client().request(
            "PUT",
            endpoint.format(property_id=property_ref.external_property_id),
            json={"rates": [rate_update_payload(update) for update in updates]},
        )
        return ConnectorResult(
            provider=self.provider,
            status="succeeded",
            external_request_id=response.get("requestId") or f"rr_{uuid4()}",
            response=response,
        )

    def _client(self) -> IntegrationHttpClient:
        token = self.credentials.access_token or self.credentials.api_key
        if not token:
            raise CredentialError(f"{self.provider.value} requires partner API credentials")
        return IntegrationHttpClient(
            self.metadata.get("base_url", ""),
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )


class AirbnbPartnerConnector(PartnerOtaConnector):
    provider = PmsProvider.airbnb


class VrboPartnerConnector(PartnerOtaConnector):
    provider = PmsProvider.vrbo


class DirectSiteConnector(PartnerOtaConnector):
    provider = PmsProvider.direct
    capabilities = ProviderCapabilities(
        pull_rates=True,
        push_rates=False,
        pull_reservations=False,
        supports_playwright_fallback=True,
    )

    def push_rates(
        self,
        property_ref: ChannelPropertyRef,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        raise PartnerAccessRequired("Direct-site API push is unavailable; use adaptive Playwright fallback")


def normalize_rate_payload(payload: dict) -> list[ChannelRate]:
    raw_rates = payload.get("rates") or payload.get("calendar") or payload.get("result") or payload.get("data") or []
    if isinstance(raw_rates, dict):
        raw_rates = raw_rates.get("rates") or raw_rates.get("days") or raw_rates.get("items") or []
    rates: list[ChannelRate] = []
    for item in raw_rates:
        if not isinstance(item, dict):
            continue
        stay_date = item.get("date") or item.get("stayDate") or item.get("startDate")
        if not stay_date:
            continue
        price = item.get("rate_cents") or item.get("rateCents")
        if price is None:
            price_value = item.get("price") or item.get("nightlyRate") or item.get("dailyRate")
            price = int(float(price_value) * 100) if price_value is not None else None
        rates.append(
            ChannelRate(
                stay_date=date.fromisoformat(str(stay_date)[:10]),
                rate_cents=int(price) if price is not None else None,
                available=item.get("available"),
                min_stay=item.get("minStay") or item.get("min_nights") or item.get("minimumStay"),
                max_stay=item.get("maxStay") or item.get("max_nights"),
                currency_code=item.get("currency") or item.get("currency_code") or "USD",
                raw_payload=item,
            )
        )
    return rates


def rate_update_payload(update: ChannelRateUpdate) -> dict:
    return {
        "date": update.stay_date.isoformat(),
        "rateCents": update.rate_cents,
        "price": round(update.rate_cents / 100, 2),
        "minStay": update.min_stay,
        "available": update.available,
        "currency": update.currency_code,
        "channel": update.channel,
    }


def booking_availability_xml(
    hotel_id: str,
    room_id: str,
    rate_id: str,
    updates: list[ChannelRateUpdate],
) -> str:
    rows = []
    for update in updates:
        rows.append(
            f"""
      <date value="{update.stay_date.isoformat()}">
        <room id="{room_id}">
          <rate id="{rate_id}" price="{update.rate_cents / 100:.2f}"{f' min_advance_res="{update.min_stay}"' if update.min_stay else ''} />
        </room>
      </date>""".rstrip()
        )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>{hotel_id}</hotel_id>
  <version>1.0</version>
  <availability>{''.join(rows)}
  </availability>
</request>"""
