-- Update RLS policies for vps_instances to support instance-level authorization
-- Logic: Users can see VPS instances if:
-- 1. They are admin, OR
-- 2. They have 'read' permission for VPS module (can see ALL instances), OR  
-- 3. They have a specific allocation for that instance (can see ONLY allocated instances)

-- Drop existing policies
drop policy if exists "vps_instances_select" on public.vps_instances;
drop policy if exists "vps_instances_insert" on public.vps_instances;
drop policy if exists "vps_instances_update" on public.vps_instances;
drop policy if exists "vps_instances_delete" on public.vps_instances;
drop policy if exists "Admins can view vps_instances" on public.vps_instances;
drop policy if exists "Admins can insert vps_instances" on public.vps_instances;
drop policy if exists "Admins can update vps_instances" on public.vps_instances;
drop policy if exists "Admins can delete vps_instances" on public.vps_instances;

-- Create new select policy
-- Users can see instances if they are admin, have read permission, OR have specific allocation
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

-- Insert policy (admin or manage permission required)
create policy "vps_instances_insert"
  on public.vps_instances for insert
  with check ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  );

-- Update policy (admin or manage permission required)
create policy "vps_instances_update"
  on public.vps_instances for update
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  )
  with check (
    public.is_admin() 
    or public.has_module_permission('vps', 'manage')
  );

-- Delete policy (admin or manage permission required)
create policy "vps_instances_delete"
  on public.vps_instances for delete
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  );
