-- RentalRadar.ai pricing engine support:
-- demand signals, experiments, assignments, and realized performance.

alter table public.pricing_recommendations
  add column if not exists recommended_min_stay integer check (
    recommended_min_stay is null or recommended_min_stay >= 1
  ),
  add column if not exists discount_percent numeric(5,2) check (
    discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)
  );

create table if not exists public.local_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  name text not null,
  category text,
  starts_on date not null,
  ends_on date not null,
  distance_km numeric(6,2),
  demand_score numeric(5,4) not null default 0.5 check (demand_score >= 0 and demand_score <= 1),
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_events_date_check check (ends_on >= starts_on)
);

create table if not exists public.occupancy_signals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  stay_date date not null,
  property_occupancy numeric(5,4) check (property_occupancy is null or (property_occupancy >= 0 and property_occupancy <= 1)),
  market_occupancy numeric(5,4) check (market_occupancy is null or (market_occupancy >= 0 and market_occupancy <= 1)),
  pacing_ratio numeric(7,4),
  pickup_7d integer,
  pickup_30d integer,
  source text not null default 'pms',
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed', 'canceled')),
  hypothesis text,
  variants jsonb not null,
  traffic_split jsonb not null default '{}'::jsonb,
  primary_metric text not null default 'revpar',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.pricing_experiments(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  pricing_recommendation_id uuid references public.pricing_recommendations(id) on delete set null,
  stay_date date not null,
  variant_key text not null,
  assigned_rate_cents integer not null check (assigned_rate_cents >= 0),
  assigned_min_stay integer check (assigned_min_stay is null or assigned_min_stay >= 1),
  assigned_discount_percent numeric(5,2) check (
    assigned_discount_percent is null or (assigned_discount_percent >= 0 and assigned_discount_percent <= 100)
  ),
  assignment_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (experiment_id, property_id, stay_date)
);

create table if not exists public.pricing_performance_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  pricing_recommendation_id uuid references public.pricing_recommendations(id) on delete set null,
  experiment_assignment_id uuid references public.pricing_experiment_assignments(id) on delete set null,
  stay_date date not null,
  booked boolean not null default false,
  booked_at timestamptz,
  realized_rate_cents integer check (realized_rate_cents is null or realized_rate_cents >= 0),
  revenue_cents integer check (revenue_cents is null or revenue_cents >= 0),
  occupancy_status text not null default 'unknown' check (
    occupancy_status in ('unknown', 'available', 'held', 'booked', 'blocked')
  ),
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists local_events_org_dates_idx
  on public.local_events(organization_id, starts_on, ends_on);
create index if not exists occupancy_signals_property_date_idx
  on public.occupancy_signals(property_id, stay_date, observed_at desc);
create index if not exists pricing_experiments_org_status_idx
  on public.pricing_experiments(organization_id, status);
create index if not exists pricing_assignments_property_date_idx
  on public.pricing_experiment_assignments(property_id, stay_date);
create index if not exists pricing_performance_property_date_idx
  on public.pricing_performance_events(property_id, stay_date);

create trigger set_local_events_updated_at before update on public.local_events
  for each row execute function public.set_updated_at();
create trigger set_pricing_experiments_updated_at before update on public.pricing_experiments
  for each row execute function public.set_updated_at();

alter table public.local_events enable row level security;
alter table public.occupancy_signals enable row level security;
alter table public.pricing_experiments enable row level security;
alter table public.pricing_experiment_assignments enable row level security;
alter table public.pricing_performance_events enable row level security;

create policy "members can read local events"
  on public.local_events for select
  using (public.is_org_member(organization_id));

create policy "members can read occupancy signals"
  on public.occupancy_signals for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read pricing experiments"
  on public.pricing_experiments for select
  using (public.is_org_member(organization_id));

create policy "members can read pricing assignments"
  on public.pricing_experiment_assignments for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read pricing performance"
  on public.pricing_performance_events for select
  using (public.is_org_member(public.property_org_id(property_id)));
