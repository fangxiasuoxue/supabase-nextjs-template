create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','operator','user')),
  created_at timestamptz default now(),
  primary key(user_id)
);

create table if not exists public.module_permissions (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  module text not null check (module in ('vps','nodes','ip','orders')),
  can_read boolean default false,
  can_write boolean default false,
  can_manage boolean default false,
  unique(user_id, module)
);

create table if not exists public.ip_assets (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  provider text not null,
  ip text not null,
  country text,
  asn text,
  type text check (type in ('residential','datacenter')),
  status text,
  owner uuid references auth.users(id) on delete cascade,
  expires_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  unique(provider, ip)
);

create index if not exists ip_assets_owner_idx on public.ip_assets(owner);
create index if not exists ip_assets_status_idx on public.ip_assets(status);
create index if not exists ip_assets_expires_idx on public.ip_assets(expires_at);
create index if not exists ip_assets_provider_idx on public.ip_assets(provider);
create index if not exists ip_assets_country_idx on public.ip_assets(country);

create table if not exists public.ip_allocations (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  ip_id bigint references public.ip_assets(id) on delete cascade,
  assigned_to text,
  state text check (state in ('allocated','released')),
  allocated_at timestamptz,
  released_at timestamptz,
  notes text,
  owner uuid references auth.users(id) on delete cascade
);

create index if not exists ip_allocations_ip_idx on public.ip_allocations(ip_id);
create index if not exists ip_allocations_state_idx on public.ip_allocations(state);
create index if not exists ip_allocations_owner_idx on public.ip_allocations(owner);
create index if not exists ip_allocations_allocated_idx on public.ip_allocations(allocated_at);

create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists(
    select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;

create or replace function public.has_module_permission(m text, p text) returns boolean language sql stable as $$
  select coalesce(
    case p
      when 'read' then exists(select 1 from public.module_permissions mp where mp.user_id = auth.uid() and mp.module = m and mp.can_read)
      when 'write' then exists(select 1 from public.module_permissions mp where mp.user_id = auth.uid() and mp.module = m and mp.can_write)
      when 'manage' then exists(select 1 from public.module_permissions mp where mp.user_id = auth.uid() and mp.module = m and mp.can_manage)
      else false
    end
  , false);
$$;

alter table public.user_roles enable row level security;
alter table public.module_permissions enable row level security;
alter table public.ip_assets enable row level security;
alter table public.ip_allocations enable row level security;

create policy user_roles_select_self on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_roles_modify_admin on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

create policy module_permissions_select_self on public.module_permissions
  for select using (user_id = auth.uid() or public.is_admin());

create policy module_permissions_modify_admin on public.module_permissions
  for all using (public.is_admin()) with check (public.is_admin());

create policy ip_assets_select on public.ip_assets
  for select using (
    public.is_admin() or owner = auth.uid() or public.has_module_permission('ip','read')
  );

create policy ip_assets_insert on public.ip_assets
  for insert with check (
    (public.is_admin() or public.has_module_permission('ip','write')) and owner = auth.uid()
  );

create policy ip_assets_update on public.ip_assets
  for update using (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  ) with check (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  );

create policy ip_assets_delete on public.ip_assets
  for delete using (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  );

create policy ip_allocations_select on public.ip_allocations
  for select using (
    public.is_admin() or owner = auth.uid() or public.has_module_permission('ip','read')
  );

create policy ip_allocations_insert on public.ip_allocations
  for insert with check (
    (public.is_admin() or public.has_module_permission('ip','write')) and owner = auth.uid()
  );

create policy ip_allocations_update on public.ip_allocations
  for update using (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  ) with check (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  );

create policy ip_allocations_delete on public.ip_allocations
  for delete using (
    public.is_admin() or public.has_module_permission('ip','manage') or (public.has_module_permission('ip','write') and owner = auth.uid())
  );

grant select on public.user_roles to anon, authenticated;
grant select, insert, update, delete on public.module_permissions to authenticated;
grant select, insert, update, delete on public.ip_assets to authenticated;
grant select, insert, update, delete on public.ip_allocations to authenticated;