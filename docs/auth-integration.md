# Clerk / Supabase Auth Integration

The schema supports either auth provider without changing application tables.

## Supabase Auth

Use `auth.users(id)` as the identity source:

1. Create a Supabase user.
2. Insert or upsert `public.app_users.supabase_auth_user_id = auth.users.id`.
3. Add the user to `public.organization_members`.
4. Supabase RLS resolves the app user through `public.current_app_user_id()`.

## Clerk

Use Clerk as the identity provider and keep Supabase/Postgres as the data layer:

1. Configure Clerk JWTs for Supabase so the JWT `sub` claim is the Clerk user ID.
2. On Clerk `user.created` and `user.updated` webhooks, upsert:

```sql
insert into public.app_users (
  email,
  full_name,
  avatar_url,
  clerk_user_id
) values (
  :email,
  :full_name,
  :avatar_url,
  :clerk_user_id
)
on conflict (clerk_user_id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  updated_at = now();
```

3. Create or assign an organization, then insert `public.organization_members`.
4. RLS resolves the app user through `auth.jwt() ->> 'sub'`.

## Backend Service Role

Scrapers, pricing workers, PMS token storage, Stripe webhooks, and agent training writes should use a backend service role, not direct client writes. The client-facing RLS policies are intentionally read-focused for Phase 1.

## Token Storage

`public.pms_connections.access_token_encrypted` and `refresh_token_encrypted` should only receive ciphertext. Encrypt in the FastAPI backend with a KMS-backed envelope key before inserting rows.
