# RentalRadar.ai FastAPI Backend

Phase 1 backend for property onboarding, live market-rate scraping, PMS connection storage, and optimized rate pushes.

## Run locally

```bash
cd apps/api
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
playwright install chromium
uvicorn app.main:app --reload --port 8000
```

Worker:

```bash
cd apps/api
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

Beat scheduler:

```bash
cd apps/api
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```

## Auth context

Until the Clerk/Supabase middleware is wired, API calls accept:

- `X-Organization-Id`
- `X-User-Id`

Production should derive these from Clerk or Supabase JWT claims and reject spoofed headers at the edge.

## Pricing engine

The engine lives in `app/services/pricing_engine.py` and combines:

- fresh scraped comp rates and availability compression
- optional market booked-rate benchmarks from AirROI
- seasonality and day-of-week curves
- lead-time urgency
- local events
- PMS/market occupancy and pacing
- historical performance events
- an LLM advisory seam for qualitative risk and demand notes
- A/B experiment assignment and result aggregation

Useful endpoints:

- `POST /pricing/events`
- `POST /pricing/occupancy-signals`
- `POST /pricing/recommendations/run`
- `POST /pricing/experiments`
- `GET /pricing/experiments/{experiment_id}/results`
- `POST /pricing/performance`

Optional booked-rate market data:

- `MARKET_BOOKED_DATA_PROVIDER=airroi`
- `AIRROI_API_KEY=...`
- `AIRROI_BASE_URL=https://api.airroi.com`
- `AIRROI_RADIUS_MILES=5`
- `AIRROI_PAGE_SIZE=50`

When enabled, the recommendation run calls AirROI's radius listing search once per property/run,
summarizes nearby historical ADR/occupancy/RevPAR fields, and blends that paid-market signal
with RentalRadar's live guest-visible comp rates.

## PMS and OTA sync

The production connector layer lives in `app/integrations` and is called through `app/services/pms.py`.

Supported adapter paths:

- Guesty Open API
- Hostaway Public API
- Streamline Open API
- CiiRUS API
- Lodgify API-compatible calendar endpoints
- OwnerRez API-compatible availability/rate endpoints
- Hostfully API-compatible calendar endpoints
- Booking.com Connectivity API for certified partners
- Airbnb/VRBO partner API endpoints when certified channel-manager access exists

Core rule: official APIs are used for connected user-owned properties. Adaptive headed Playwright is reserved for public market comp research and user-supplied public Airbnb/VRBO listing baselines when no PMS is connected.

Credentials are stored through `CredentialVault`, encrypted before entering `pms_connections.credentials_encrypted`. RentalRadar never stores PMS passwords; it stores only official API keys, OAuth tokens, API secrets, and webhook secrets. Do not put secrets in `metadata`; the connect route strips common secret keys.

Useful endpoints:

- `POST /pms/connect`
- `POST /pms/map-property`
- `POST /pms/sync`
- `POST /webhooks/pms/{provider}/{connection_id}`
- `POST /pms/fallback/public-listing-scan`
- `POST /pricing/push`

Celery jobs:

- `pull_rates_from_pms`
- `push_rate_to_pms`
- `sync_all_pms_connections` every 30 minutes

## Billing, usage, and ops

Stripe billing is configurable through environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `APP_BASE_URL`

Useful endpoints:

- `POST /billing/checkout` creates a per-property monthly Stripe Checkout subscription or activates the free tier.
- `POST /billing/portal` creates a Stripe customer portal session.
- `GET /billing/usage` returns the active plan and current compute/job counters.
- `POST /webhooks/stripe` verifies Stripe signatures and syncs subscription state.
- `GET /ops/errors` returns failed scrape, PMS sync, rate push, and billing events for dashboards.
- `GET /legal/scraping-notice` returns operator-facing scraping compliance copy.

Guardrails are enforced before expensive work is queued:

- Free tier: 1 active property, limited scans, no PMS push.
- Compute budgets: monthly compute units plus daily non-API job caps.
- Queue path: API routes and scheduled Celery tasks record `usage_events` before dispatching scrape/sync/push work.
