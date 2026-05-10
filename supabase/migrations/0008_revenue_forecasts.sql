-- 24-month revenue forecast engine storage.

create table if not exists public.revenue_forecasts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  forecast_month date not null,
  projected_revenue_cents integer not null default 0 check (projected_revenue_cents >= 0),
  baseline_revenue_cents integer not null default 0 check (baseline_revenue_cents >= 0),
  extra_income_cents integer not null default 0,
  wheelhouse_beyond_revenue_cents integer not null default 0 check (wheelhouse_beyond_revenue_cents >= 0),
  occupancy_pct numeric(5,4) not null default 0 check (occupancy_pct >= 0 and occupancy_pct <= 1),
  baseline_occupancy_pct numeric(5,4) not null default 0 check (baseline_occupancy_pct >= 0 and baseline_occupancy_pct <= 1),
  confidence_score numeric(5,4) not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  rate_lift_cents integer not null default 0,
  occupancy_lift_cents integer not null default 0,
  discount_impact_cents integer not null default 0,
  explanation text not null,
  nightly_points jsonb not null default '[]'::jsonb,
  model_version text not null default 'revenue-forecast-v1',
  generated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (property_id, forecast_month)
);

create index if not exists revenue_forecasts_property_month_idx
  on public.revenue_forecasts(property_id, forecast_month);

alter table public.revenue_forecasts enable row level security;

create policy "organization members can read revenue forecasts"
  on public.revenue_forecasts
  for select
  using (
    exists (
      select 1
      from public.properties p
      join public.organization_members om on om.organization_id = p.organization_id
      join public.app_users u on u.id = om.user_id
      where p.id = revenue_forecasts.property_id
        and (u.supabase_auth_user_id = auth.uid())
    )
  );
