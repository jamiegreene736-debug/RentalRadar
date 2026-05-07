insert into public.subscription_plans (
  code,
  name,
  monthly_price_cents,
  max_scrapes_per_property_month,
  max_competitors_per_property,
  supports_pms_push,
  metadata
) values
  (
    'starter_3',
    'Starter',
    300,
    120,
    10,
    false,
    '{"positioning":"Entry plan for rate intelligence only"}'::jsonb
  ),
  (
    'growth_6',
    'Growth',
    600,
    300,
    25,
    true,
    '{"positioning":"Recommended plan for automated pricing and PMS push"}'::jsonb
  ),
  (
    'pro_9',
    'Pro',
    900,
    720,
    50,
    true,
    '{"positioning":"High-frequency scraping and broader comp tracking"}'::jsonb
  )
on conflict (code) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  max_scrapes_per_property_month = excluded.max_scrapes_per_property_month,
  max_competitors_per_property = excluded.max_competitors_per_property,
  supports_pms_push = excluded.supports_pms_push,
  metadata = excluded.metadata,
  updated_at = now();
