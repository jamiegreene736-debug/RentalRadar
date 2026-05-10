-- Adds event, weather, and flight pressure as first-class pricing inputs.

create table if not exists public.pricing_demand_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  signal_type text not null check (
    signal_type in ('area_event', 'weather', 'flight', 'market', 'holiday', 'custom')
  ),
  label text not null,
  starts_on date not null,
  ends_on date not null,
  demand_score numeric(5,4) not null default 0.5 check (demand_score >= 0 and demand_score <= 1),
  rate_impact_percent numeric(6,4) check (
    rate_impact_percent is null or (rate_impact_percent >= -0.5 and rate_impact_percent <= 0.5)
  ),
  confidence numeric(5,4) not null default 0.65 check (confidence >= 0 and confidence <= 1),
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_demand_signals_date_check check (ends_on >= starts_on)
);

create index if not exists pricing_demand_signals_org_dates_idx
  on public.pricing_demand_signals(organization_id, starts_on, ends_on);
create index if not exists pricing_demand_signals_property_dates_idx
  on public.pricing_demand_signals(property_id, starts_on, ends_on);

create trigger set_pricing_demand_signals_updated_at before update on public.pricing_demand_signals
  for each row execute function public.set_updated_at();

alter table public.pricing_demand_signals enable row level security;

create policy "members can read pricing demand signals"
  on public.pricing_demand_signals for select
  using (public.is_org_member(organization_id));
