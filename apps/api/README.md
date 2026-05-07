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
