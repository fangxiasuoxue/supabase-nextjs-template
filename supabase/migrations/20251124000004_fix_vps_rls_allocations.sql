-- Fix VPS RLS policies to support instance-level authorization
-- This migration updates the vps_instances select policy to check vps_allocations

-- Drop and recreate the select policy with allocation check
drop policy if exists "vps_instances_select" on public.vps_instances;

create policy "vps_instances_select"
  on public.vps_instances for select
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'read')
    or exists (
      select 1 from public.vps_allocations 
      where vps_allocations.vps_id = vps_instances.id 
      and vps_allocations.owner = auth.uid()
      and vps_allocations.state = 'allocated'
    )
  );
