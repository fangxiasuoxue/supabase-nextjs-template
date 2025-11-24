create table if not exists public.vps_instances (
  id uuid default gen_random_uuid() primary key,
  instance_id text not null,
  account text not null,
  name text not null,
  zone text not null,
  status text not null,
  machine_type text,
  internal_ip text,
  external_ip text,
  traffic_received float default 0,
  traffic_sent float default 0,
  billing_used float default 0,
  billing_remaining float default 0,
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  unique(instance_id)
);

-- Enable RLS
alter table public.vps_instances enable row level security;

-- Policies
create policy "Admins can view vps_instances"
  on public.vps_instances for select
  using ( is_admin() );

create policy "Admins can insert vps_instances"
  on public.vps_instances for insert
  with check ( is_admin() );

create policy "Admins can update vps_instances"
  on public.vps_instances for update
  using ( is_admin() );

create policy "Admins can delete vps_instances"
  on public.vps_instances for delete
  using ( is_admin() );
