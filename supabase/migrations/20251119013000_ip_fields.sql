alter table public.ip_assets
  add column if not exists provider_id text,
  add column if not exists country_code text,
  add column if not exists network_type text,
  add column if not exists proxy_type text,
  add column if not exists ip_version text,
  add column if not exists public_ip text,
  add column if not exists connect_ip text,
  add column if not exists http_port int,
  add column if not exists https_port int,
  add column if not exists socks5_port int,
  add column if not exists auth_username text,
  add column if not exists auth_password text,
  add column if not exists isp_name text,
  add column if not exists bandwidth_total numeric,
  add column if not exists bandwidth_used numeric,
  add column if not exists routes jsonb default '[]'::jsonb,
  add column if not exists last_sync_at timestamptz,
  add column if not exists source_url text,
  add column if not exists source_raw jsonb;

do $$ begin
  if not exists (
    select 1 from pg_indexes where tablename='ip_assets' and indexname='ip_assets_unique_provider_publicip'
  ) then
    create unique index ip_assets_unique_provider_publicip on public.ip_assets(provider, public_ip);
  end if;
end $$;

alter table public.ip_allocations
  add column if not exists assignee_user_id uuid references auth.users(id);

alter table public.ip_assets enable row level security;
alter table public.ip_allocations enable row level security;

create policy ip_allocations_select_assignee on public.ip_allocations
  for select using (
    assignee_user_id = auth.uid() or public.is_admin() or public.has_module_permission('ip','read')
  );