-- Create vps_allocations table for instance-level authorization
create table if not exists public.vps_allocations (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  vps_id uuid references public.vps_instances(id) on delete cascade,
  assigned_to text,
  state text check (state in ('allocated','released')),
  allocated_at timestamptz,
  released_at timestamptz,
  notes text,
  owner uuid references auth.users(id) on delete cascade
);

-- Create indexes
create index if not exists vps_allocations_vps_idx on public.vps_allocations(vps_id);
create index if not exists vps_allocations_state_idx on public.vps_allocations(state);
create index if not exists vps_allocations_owner_idx on public.vps_allocations(owner);
create index if not exists vps_allocations_allocated_idx on public.vps_allocations(allocated_at);

-- Enable RLS
alter table public.vps_allocations enable row level security;

-- RLS Policies for vps_allocations
create policy vps_allocations_select
  on public.vps_allocations for select
  using (
    public.is_admin() 
    or owner = auth.uid() 
    or public.has_module_permission('vps','read')
  );

create policy vps_allocations_insert
  on public.vps_allocations for insert
  with check (
    (public.is_admin() or public.has_module_permission('vps','manage')) 
    and owner = auth.uid()
  );

create policy vps_allocations_update
  on public.vps_allocations for update
  using (
    public.is_admin() 
    or public.has_module_permission('vps','manage') 
    or (public.has_module_permission('vps','write') and owner = auth.uid())
  )
  with check (
    public.is_admin() 
    or public.has_module_permission('vps','manage') 
    or (public.has_module_permission('vps','write') and owner = auth.uid())
  );

create policy vps_allocations_delete
  on public.vps_allocations for delete
  using (
    public.is_admin() 
    or public.has_module_permission('vps','manage') 
    or (public.has_module_permission('vps','write') and owner = auth.uid())
  );

-- Grant permissions
grant select, insert, update, delete on public.vps_allocations to authenticated;
