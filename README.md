# RentalRadar.ai Database Schema

This package contains the Phase 1 PostgreSQL schema for RentalRadar.ai.

Primary source of truth:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_subscription_plans.sql`
- `supabase/migrations/0004_channel_integrations.sql`
- `supabase/migrations/0005_billing_usage_guardrails.sql`

Useful mirrors for application code:

- `prisma/schema.prisma`
- `types/database.ts`
- `types/database.py`

Backend:

- `apps/api` contains the FastAPI API, Celery workers, Redis cache helpers, PMS token encryption, proxy rotation, and the multi-agent scraping pipeline.

Auth support:

- Clerk: store `clerk_user_id` on `public.app_users`.
- Supabase Auth: store `supabase_auth_user_id`, linked to `auth.users(id)`.

Subscriptions are modeled per property per month through `property_subscriptions`, with Stripe subscription item IDs suitable for per-property billing.

Billing and guardrails:

- Stripe Checkout and Billing Portal endpoints live at `POST /billing/checkout` and `POST /billing/portal`.
- Free tier is seeded as `free_1`: 1 active property, limited monthly scans, and lower compute budgets.
- Usage guardrails are recorded in `usage_events` and enforced before scans, PMS syncs, pricing runs, and rate pushes are queued.
- Operational failures are exposed through `GET /ops/errors`; scraping policy copy is exposed through `GET /legal/scraping-notice`.
