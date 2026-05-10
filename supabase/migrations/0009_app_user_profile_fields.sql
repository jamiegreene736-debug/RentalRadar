create extension if not exists citext with schema public;

alter table public.app_users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists phone_number text,
  add column if not exists company_name text,
  add column if not exists job_title text,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists locale text not null default 'en-US',
  add column if not exists notification_email citext,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists profile_completed_at timestamptz,
  add column if not exists clerk_user_id text,
  add column if not exists supabase_auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_timezone_not_blank'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_timezone_not_blank check (length(btrim(timezone)) > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_locale_not_blank'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_locale_not_blank check (length(btrim(locale)) > 0) not valid;
  end if;
end $$;

create index if not exists app_users_notification_email_idx on public.app_users(notification_email);
create unique index if not exists app_users_clerk_user_id_idx on public.app_users(clerk_user_id) where clerk_user_id is not null;
create unique index if not exists app_users_supabase_auth_user_id_idx on public.app_users(supabase_auth_user_id) where supabase_auth_user_id is not null;
