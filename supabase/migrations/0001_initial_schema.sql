-- RentalRadar.ai Phase 1 schema
-- Postgres/Supabase migration

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists postgis;

create type public.user_role as enum ('owner', 'admin', 'analyst', 'readonly');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
  'incomplete',
  'incomplete_expired'
);
create type public.property_subscription_status as enum (
  'active',
  'paused',
  'canceled',
  'past_due'
);
create type public.scrape_source as enum (
  'airbnb',
  'vrbo',
  'booking',
  'direct_pms',
  'guesty',
  'hostaway',
  'ownerrez',
  'manual',
  'other'
);
create type public.scrape_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'needs_review'
);
create type public.agent_training_status as enum (
  'candidate',
  'validating',
  'approved',
  'rejected',
  'retired'
);
create type public.pricing_recommendation_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'pushed',
  'superseded'
);
create type public.pms_connection_status as enum (
  'connected',
  'needs_reauth',
  'disabled',
  'revoked',
  'error'
);
create type public.pms_provider as enum (
  'guesty',
  'hostaway',
  'ownerrez',
  'lodgify',
  'hostfully',
  'airbnb',
  'vrbo',
  'booking',
  'direct',
  'other'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  stripe_customer_id text unique,
  billing_email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  full_name text,
  avatar_url text,
  clerk_user_id text unique,
  supabase_auth_user_id uuid unique references auth.users(id) on delete set null,
  default_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_auth_provider_check check (
    clerk_user_id is not null or supabase_auth_user_id is not null
  )
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.user_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  stripe_price_id text unique,
  max_scrapes_per_property_month integer not null default 300,
  max_competitors_per_property integer not null default 25,
  supports_pms_push boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  address_line1 text not null,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code char(2) not null default 'US',
  formatted_address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geo geography(point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
      then st_setsrid(st_makepoint(longitude::double precision, latitude::double precision), 4326)::geography
      else null
    end
  ) stored,
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4,1) check (bathrooms is null or bathrooms >= 0),
  sleeps integer check (sleeps is null or sleeps >= 0),
  property_type text,
  timezone text not null default 'America/New_York',
  currency_code char(3) not null default 'USD',
  base_price_cents integer check (base_price_cents is null or base_price_cents >= 0),
  min_price_cents integer check (min_price_cents is null or min_price_cents >= 0),
  max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_price_bounds_check check (
    min_price_cents is null
    or max_price_cents is null
    or min_price_cents <= max_price_cents
  )
);

create table public.property_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  stripe_subscription_item_id text unique,
  status public.property_subscription_status not null default 'active',
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_subscription_time_check check (ends_at is null or ends_at > starts_at)
);

create unique index property_subscriptions_one_active_per_property
  on public.property_subscriptions(property_id)
  where status in ('active', 'past_due');

create table public.comp_sets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null default 'Default comp set',
  search_radius_km numeric(6,2),
  bedrooms_min integer,
  bedrooms_max integer,
  sleeps_min integer,
  sleeps_max integer,
  active boolean not null default true,
  selection_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  comp_set_id uuid not null references public.comp_sets(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  source public.scrape_source not null,
  external_id text,
  external_url text not null,
  canonical_url text,
  title text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  bedrooms integer,
  bathrooms numeric(4,1),
  sleeps integer,
  rating numeric(3,2),
  review_count integer,
  similarity_score numeric(5,4),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comp_set_id, source, external_url)
);

create table public.pms_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.pms_provider not null,
  account_ref text,
  display_name text,
  status public.pms_connection_status not null default 'connected',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_cipher text not null default 'kms:aes-256-gcm',
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  last_verified_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, account_ref)
);

create table public.property_pms_mappings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  pms_connection_id uuid not null references public.pms_connections(id) on delete cascade,
  external_property_id text not null,
  external_channel_ids jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, pms_connection_id),
  unique (pms_connection_id, external_property_id)
);

create table public.scraper_strategies (
  id uuid primary key default gen_random_uuid(),
  source public.scrape_source not null,
  domain text not null,
  layout_fingerprint text not null,
  strategy_json jsonb not null,
  version integer not null default 1,
  success_rate numeric(5,4) not null default 0,
  active boolean not null default true,
  created_by_agent text,
  approved_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, domain, layout_fingerprint, version)
);

create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  scraper_strategy_id uuid references public.scraper_strategies(id) on delete set null,
  source public.scrape_source not null,
  target_url text not null,
  stay_date_start date,
  stay_date_end date,
  status public.scrape_job_status not null default 'queued',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_by text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  request_context jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scrape_job_logs (
  id bigserial primary key,
  scrape_job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  level text not null check (level in ('debug', 'info', 'warning', 'error')),
  event text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.scrape_snapshots (
  id uuid primary key default gen_random_uuid(),
  scrape_job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  source public.scrape_source not null,
  raw_html_url text,
  screenshot_url text,
  network_trace_url text,
  dom_fingerprint text,
  layout_fingerprint text,
  extraction_confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_observations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  scrape_job_id uuid references public.scrape_jobs(id) on delete set null,
  scrape_snapshot_id uuid references public.scrape_snapshots(id) on delete set null,
  source public.scrape_source not null,
  stay_date date not null,
  currency_code char(3) not null default 'USD',
  nightly_rate_cents integer check (nightly_rate_cents is null or nightly_rate_cents >= 0),
  total_rate_cents integer check (total_rate_cents is null or total_rate_cents >= 0),
  fees_cents integer check (fees_cents is null or fees_cents >= 0),
  taxes_cents integer check (taxes_cents is null or taxes_cents >= 0),
  available boolean,
  min_nights integer check (min_nights is null or min_nights >= 1),
  max_nights integer check (max_nights is null or max_nights >= 1),
  cancellation_policy text,
  extraction_confidence numeric(5,4),
  observed_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index rate_observations_property_date_idx
  on public.rate_observations(property_id, stay_date, observed_at desc);
create index rate_observations_competitor_date_idx
  on public.rate_observations(competitor_id, stay_date, observed_at desc);

create table public.pricing_recommendations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  stay_date date not null,
  currency_code char(3) not null default 'USD',
  current_rate_cents integer check (current_rate_cents is null or current_rate_cents >= 0),
  recommended_rate_cents integer not null check (recommended_rate_cents >= 0),
  min_rate_cents integer check (min_rate_cents is null or min_rate_cents >= 0),
  max_rate_cents integer check (max_rate_cents is null or max_rate_cents >= 0),
  confidence numeric(5,4),
  status public.pricing_recommendation_status not null default 'draft',
  model_version text not null,
  comp_set_id uuid references public.comp_sets(id) on delete set null,
  reason jsonb not null default '{}'::jsonb,
  approved_by_user_id uuid references public.app_users(id) on delete set null,
  approved_at timestamptz,
  superseded_by_id uuid references public.pricing_recommendations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_recommendation_bounds_check check (
    min_rate_cents is null
    or max_rate_cents is null
    or min_rate_cents <= max_rate_cents
  )
);

create unique index pricing_recommendations_one_live_per_day
  on public.pricing_recommendations(property_id, stay_date)
  where status in ('draft', 'pending_approval', 'approved', 'pushed');

create table public.rate_pushes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  pms_connection_id uuid not null references public.pms_connections(id) on delete cascade,
  pricing_recommendation_id uuid references public.pricing_recommendations(id) on delete set null,
  stay_date date not null,
  currency_code char(3) not null default 'USD',
  rate_cents integer not null check (rate_cents >= 0),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  external_request_id text,
  external_response jsonb not null default '{}'::jsonb,
  error_message text,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_training_runs (
  id uuid primary key default gen_random_uuid(),
  scrape_job_id uuid references public.scrape_jobs(id) on delete set null,
  scraper_strategy_id uuid references public.scraper_strategies(id) on delete set null,
  source public.scrape_source not null,
  domain text not null,
  layout_fingerprint text,
  agent_name text not null,
  model_name text,
  prompt_version text,
  status public.agent_training_status not null default 'candidate',
  input_snapshot_url text,
  input_dom_url text,
  generated_strategy_json jsonb,
  validation_report jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  token_usage jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger set_app_users_updated_at before update on public.app_users
  for each row execute function public.set_updated_at();
create trigger set_subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();
create trigger set_organization_subscriptions_updated_at before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();
create trigger set_properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger set_property_subscriptions_updated_at before update on public.property_subscriptions
  for each row execute function public.set_updated_at();
create trigger set_comp_sets_updated_at before update on public.comp_sets
  for each row execute function public.set_updated_at();
create trigger set_competitors_updated_at before update on public.competitors
  for each row execute function public.set_updated_at();
create trigger set_pms_connections_updated_at before update on public.pms_connections
  for each row execute function public.set_updated_at();
create trigger set_property_pms_mappings_updated_at before update on public.property_pms_mappings
  for each row execute function public.set_updated_at();
create trigger set_scraper_strategies_updated_at before update on public.scraper_strategies
  for each row execute function public.set_updated_at();
create trigger set_scrape_jobs_updated_at before update on public.scrape_jobs
  for each row execute function public.set_updated_at();
create trigger set_pricing_recommendations_updated_at before update on public.pricing_recommendations
  for each row execute function public.set_updated_at();
create trigger set_rate_pushes_updated_at before update on public.rate_pushes
  for each row execute function public.set_updated_at();

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select id
  from public.app_users
  where supabase_auth_user_id = auth.uid()
    or clerk_user_id = auth.jwt() ->> 'sub'
  limit 1
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = public.current_app_user_id()
  )
$$;

create or replace function public.property_org_id(target_property_id uuid)
returns uuid
language sql
stable
as $$
  select organization_id
  from public.properties
  where id = target_property_id
  limit 1
$$;

alter table public.organizations enable row level security;
alter table public.app_users enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.properties enable row level security;
alter table public.property_subscriptions enable row level security;
alter table public.comp_sets enable row level security;
alter table public.competitors enable row level security;
alter table public.pms_connections enable row level security;
alter table public.property_pms_mappings enable row level security;
alter table public.scraper_strategies enable row level security;
alter table public.scrape_jobs enable row level security;
alter table public.scrape_job_logs enable row level security;
alter table public.scrape_snapshots enable row level security;
alter table public.rate_observations enable row level security;
alter table public.pricing_recommendations enable row level security;
alter table public.rate_pushes enable row level security;
alter table public.agent_training_runs enable row level security;
alter table public.audit_logs enable row level security;

create policy "members can read their organizations"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "users can read own user row"
  on public.app_users for select
  using (id = public.current_app_user_id());

create policy "members can read organization members"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "members can read organization subscriptions"
  on public.organization_subscriptions for select
  using (public.is_org_member(organization_id));

create policy "members can read properties"
  on public.properties for select
  using (public.is_org_member(organization_id));

create policy "members can read property subscriptions"
  on public.property_subscriptions for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read comp sets"
  on public.comp_sets for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read competitors"
  on public.competitors for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read pms connections"
  on public.pms_connections for select
  using (public.is_org_member(organization_id));

create policy "members can read property pms mappings"
  on public.property_pms_mappings for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read scrape jobs"
  on public.scrape_jobs for select
  using (public.is_org_member(organization_id));

create policy "members can read scrape logs"
  on public.scrape_job_logs for select
  using (
    exists (
      select 1 from public.scrape_jobs sj
      where sj.id = scrape_job_id
        and public.is_org_member(sj.organization_id)
    )
  );

create policy "members can read scrape snapshots"
  on public.scrape_snapshots for select
  using (
    exists (
      select 1 from public.scrape_jobs sj
      where sj.id = scrape_job_id
        and public.is_org_member(sj.organization_id)
    )
  );

create policy "members can read rate observations"
  on public.rate_observations for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read pricing recommendations"
  on public.pricing_recommendations for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read rate pushes"
  on public.rate_pushes for select
  using (public.is_org_member(public.property_org_id(property_id)));

create policy "members can read audit logs"
  on public.audit_logs for select
  using (public.is_org_member(organization_id));

create policy "authenticated users can read active subscription plans"
  on public.subscription_plans for select
  using (active = true);

create policy "members can read relevant agent training runs"
  on public.agent_training_runs for select
  using (
    scrape_job_id is null
    or exists (
      select 1 from public.scrape_jobs sj
      where sj.id = scrape_job_id
        and public.is_org_member(sj.organization_id)
    )
  );

-- Scraper strategies do not contain customer secrets and may be shared read-only
-- to authenticated app users. Mutations should happen through backend service role.
create policy "authenticated users can read scraper strategies"
  on public.scraper_strategies for select
  using (auth.role() = 'authenticated');

create index organizations_stripe_customer_id_idx on public.organizations(stripe_customer_id);
create index app_users_clerk_user_id_idx on public.app_users(clerk_user_id);
create index app_users_supabase_auth_user_id_idx on public.app_users(supabase_auth_user_id);
create index properties_organization_id_idx on public.properties(organization_id);
create index properties_geo_idx on public.properties using gist(geo);
create index competitors_property_id_idx on public.competitors(property_id);
create index pms_connections_organization_id_idx on public.pms_connections(organization_id);
create index scrape_jobs_status_priority_idx on public.scrape_jobs(status, priority, created_at);
create index scrape_jobs_property_id_idx on public.scrape_jobs(property_id);
create index scrape_job_logs_scrape_job_id_idx on public.scrape_job_logs(scrape_job_id, created_at);
create index pricing_recommendations_property_date_idx on public.pricing_recommendations(property_id, stay_date);
create index rate_pushes_property_date_idx on public.rate_pushes(property_id, stay_date);
create index agent_training_runs_strategy_idx on public.agent_training_runs(scraper_strategy_id);
