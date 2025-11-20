-- Drop old policies that referenced recursive functions
drop policy if exists user_roles_select_self on public.user_roles;
drop policy if exists user_roles_modify_admin on public.user_roles;
drop policy if exists module_permissions_select_self on public.module_permissions;
drop policy if exists module_permissions_modify_admin on public.module_permissions;
drop policy if exists ip_assets_select on public.ip_assets;
drop policy if exists ip_assets_insert on public.ip_assets;
drop policy if exists ip_assets_update on public.ip_assets;
drop policy if exists ip_assets_delete on public.ip_assets;
drop policy if exists ip_allocations_select on public.ip_allocations;
drop policy if exists ip_allocations_insert on public.ip_allocations;
drop policy if exists ip_allocations_update on public.ip_allocations;
drop policy if exists ip_allocations_delete on public.ip_allocations;

-- Recreate safer policies without using recursive functions
create policy user_roles_select_self on public.user_roles
  for select using (user_id = auth.uid());

-- Restrict modifications to service_role by not providing general modify policies

create policy module_permissions_select_self on public.module_permissions
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
    )
  );

create policy module_permissions_modify_admin on public.module_permissions
  for all using (
    exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
    )
  );

create policy ip_assets_select on public.ip_assets
  for select using (
    -- admin
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    -- owner
    or owner = auth.uid()
    -- module read
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_read
    )
    -- assigned to me via allocations
    or exists (
      select 1 from public.ip_allocations a
      where a.ip_id = ip_assets.id and a.assignee_user_id = auth.uid()
    )
  );

create policy ip_assets_insert on public.ip_assets
  for insert with check (
    (
      exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
      or exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      )
    ) and owner = auth.uid()
  );

create policy ip_assets_update on public.ip_assets
  for update using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  );

create policy ip_assets_delete on public.ip_assets
  for delete using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  );

create policy ip_allocations_select on public.ip_allocations
  for select using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or owner = auth.uid()
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_read
    )
    or assignee_user_id = auth.uid()
  );

create policy ip_allocations_insert on public.ip_allocations
  for insert with check (
    (
      exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
      or exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      )
    ) and owner = auth.uid()
  );

create policy ip_allocations_update on public.ip_allocations
  for update using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  );

create policy ip_allocations_delete on public.ip_allocations
  for delete using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
    or exists (
      select 1 from public.module_permissions mp
      where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_manage
    )
    or (
      exists (
        select 1 from public.module_permissions mp
        where mp.user_id = auth.uid() and mp.module = 'ip' and mp.can_write
      ) and owner = auth.uid()
    )
  );