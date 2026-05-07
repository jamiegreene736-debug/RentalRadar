# RentalRadar PMS Connection Layer

Core rule: connected user properties use official PMS or certified partner APIs. Adaptive headed Playwright is used only for public market comp research and user-supplied public Airbnb/VRBO listing baselines when no PMS is connected.

## Supported Providers

- Hostaway Public API
- Streamline Open API
- CiiRUS API
- Guesty Open API
- OwnerRez API
- Lodgify API
- Hostfully API-compatible accounts
- Future Airbnb/VRBO OAuth tokens when partner access is approved
- Booking.com Connectivity API when certified

## Secrets

RentalRadar never stores PMS passwords. Store only:

- official API keys
- access tokens
- refresh tokens
- API/client secrets
- webhook signing secrets

All values are encrypted through `CredentialVault` before persistence in `pms_connections.credentials_encrypted`. Metadata is sanitized by `/pms/connect`; do not put secrets in metadata.

## API Flow

1. UI submits `POST /pms/connect` with provider, account ref, API key/token, optional API secret, optional webhook secret.
2. Backend validates the key by calling the provider connector's official API test endpoint.
3. Backend encrypts credentials and stores a `pms_connections` row only after validation succeeds.
4. User maps RentalRadar property to PMS property with `POST /pms/map-property`.
5. Scheduled Celery syncs call official APIs:
   - `pull_rates_from_pms`
   - `push_rate_to_pms`
   - `sync_all_pms_connections`
6. PMS webhooks hit `POST /webhooks/pms/{provider}/{connection_id}` and trigger a rates refresh when the payload maps to a known property.

## Public Listing Fallback

When no PMS connection exists for a property:

```http
POST /pms/fallback/public-listing-scan
```

The route accepts user-supplied public Airbnb/VRBO listing URLs and queues headed Chrome browser-farm jobs. This is baseline data only; official PMS APIs are still the source of truth once connected.
