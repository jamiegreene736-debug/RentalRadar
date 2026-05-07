-- Stripe billing, free tier, usage guardrails, and operational visibility.

alter table public.subscription_plans
  add column if not exists free_tier boolean not null default false,
  add column if not exists max_compute_units_per_month integer not null default 10000,
  add column if not exists max_jobs_per_day integer not null default 200;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  event_type text not null check (
    event_type in ('scrape_job', 'pms_sync', 'pricing_run', 'rate_push', 'api_request')
  ),
  compute_units integer not null default 1 check (compute_units >= 0),
  source text not null default 'api',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  stripe_event_id text unique,
  event_type text not null,
  processed boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_org_created_idx
  on public.usage_events(organization_id, created_at desc);
create index if not exists usage_events_property_created_idx
  on public.usage_events(property_id, created_at desc);
create index if not exists billing_events_org_created_idx
  on public.billing_events(organization_id, created_at desc);

alter table public.usage_events enable row level security;
alter table public.billing_events enable row level security;

create policy "members can read usage events"
  on public.usage_events for select
  using (public.is_org_member(organization_id));

create policy "members can read billing events"
  on public.billing_events for select
  using (organization_id is not null and public.is_org_member(organization_id));

insert into public.subscription_plans (
  code,
  name,
  monthly_price_cents,
  max_scrapes_per_property_month,
  max_competitors_per_property,
  supports_pms_push,
  free_tier,
  max_compute_units_per_month,
  max_jobs_per_day,
  metadata
) values
  (
    'free_1',
    'Free',
    0,
    30,
    5,
    false,
    true,
    500,
    20,
    '{"included_properties":1,"positioning":"Free tier for one property with limited live scans"}'::jsonb
  )
on conflict (code) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  max_scrapes_per_property_month = excluded.max_scrapes_per_property_month,
  max_competitors_per_property = excluded.max_competitors_per_property,
  supports_pms_push = excluded.supports_pms_push,
  free_tier = excluded.free_tier,
  max_compute_units_per_month = excluded.max_compute_units_per_month,
  max_jobs_per_day = excluded.max_jobs_per_day,
  metadata = excluded.metadata,
  updated_at = now();
