create table if not exists public.system_configs (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  value text,
  description text,
  is_secret boolean default false,
  "group" text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.system_configs enable row level security;

-- Policies
-- Only admin can select
create policy system_configs_select_admin on public.system_configs
  for select using (public.is_admin());

-- Only admin can insert
create policy system_configs_insert_admin on public.system_configs
  for insert with check (public.is_admin());

-- Only admin can update
create policy system_configs_update_admin on public.system_configs
  for update using (public.is_admin()) with check (public.is_admin());

-- Only admin can delete
create policy system_configs_delete_admin on public.system_configs
  for delete using (public.is_admin());

-- Grant permissions
grant select, insert, update, delete on public.system_configs to authenticated;
