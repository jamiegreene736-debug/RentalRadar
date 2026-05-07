-- Optional high-risk server-side OTA direct push credentials.
-- Prefer official PMS/channel APIs and the Chrome/Safari extension whenever possible.

do $$
begin
  create type public.ota_direct_platform as enum ('airbnb', 'vrbo', 'booking');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ota_direct_status as enum ('pending', 'active', '2fa_required', 'failed', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.ota_direct_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  platform public.ota_direct_platform not null,
  encrypted_credentials bytea not null,
  encryption_salt text not null,
  last_successful_login timestamp with time zone,
  last_push timestamp with time zone,
  status public.ota_direct_status default 'pending',
  consent_accepted_at timestamp with time zone,
  consent_ip text,
  failure_count integer not null default 0,
  two_fa_attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, property_id, platform)
);

create index if not exists ota_direct_credentials_property_status_idx
  on public.ota_direct_credentials(property_id, status);

create index if not exists ota_direct_credentials_user_status_idx
  on public.ota_direct_credentials(user_id, status);

alter table public.ota_direct_credentials enable row level security;

create policy "Users can manage their own OTA direct credentials"
  on public.ota_direct_credentials
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
