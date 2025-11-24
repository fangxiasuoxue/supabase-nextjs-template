-- Drop existing policies
drop policy if exists "Admins can view vps_instances" on public.vps_instances;
drop policy if exists "Admins can insert vps_instances" on public.vps_instances;
drop policy if exists "Admins can update vps_instances" on public.vps_instances;
drop policy if exists "Admins can delete vps_instances" on public.vps_instances;

-- Create new policies
create policy "vps_instances_select"
  on public.vps_instances for select
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'read') 
  );

create policy "vps_instances_insert"
  on public.vps_instances for insert
  with check ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  );

create policy "vps_instances_update"
  on public.vps_instances for update
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  );

create policy "vps_instances_delete"
  on public.vps_instances for delete
  using ( 
    public.is_admin() 
    or public.has_module_permission('vps', 'manage') 
  );
