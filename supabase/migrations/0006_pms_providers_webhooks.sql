-- 2026 PMS connection layer: extensible official API providers.

alter type public.pms_provider add value if not exists 'streamline';
alter type public.pms_provider add value if not exists 'ciirus';

create index if not exists pms_connections_provider_status_idx
  on public.pms_connections(provider, status);

create index if not exists property_pms_mappings_external_property_idx
  on public.property_pms_mappings(external_property_id);
