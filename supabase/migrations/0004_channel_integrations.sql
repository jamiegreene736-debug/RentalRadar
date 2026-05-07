-- RentalRadar.ai production channel/PMS sync support.

alter table public.pms_connections
  add column if not exists credentials_encrypted jsonb,
  add column if not exists webhook_secret_encrypted text,
  add column if not exists credential_fingerprint text,
  add column if not exists credentials_version integer not null default 1,
  add column if not exists last_sync_at timestamptz;

create table if not exists public.pms_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pms_connection_id uuid not null references public.pms_connections(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  direction text not null check (direction in ('pull_rates', 'push_rates', 'pull_reservations', 'two_way')),
  provider text not null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'partial', 'skipped')
  ),
  fallback_used boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  pulled_count integer not null default 0,
  pushed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pms_sync_runs_connection_created_idx
  on public.pms_sync_runs(pms_connection_id, created_at desc);
create index if not exists pms_sync_runs_property_created_idx
  on public.pms_sync_runs(property_id, created_at desc);

alter table public.pms_sync_runs enable row level security;

create policy "members can read pms sync runs"
  on public.pms_sync_runs for select
  using (public.is_org_member(organization_id));
