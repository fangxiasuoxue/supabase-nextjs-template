-- IP 授权可见性修正:
-- module_permissions.ip.can_read 只表示可进 IP 菜单/页面,不再等于可看全量 IP。
-- 普通用户只能看到自己被授权的 IP；全量列表仅 admin / ip.manage / owner 可见。

DROP POLICY IF EXISTS ip_assets_select ON public.ip_assets;
DROP POLICY IF EXISTS "Users can view IP assets based on permissions" ON public.ip_assets;

CREATE POLICY ip_assets_select_scoped ON public.ip_assets
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
      OR EXISTS (SELECT 1 FROM public.module_permissions mp WHERE mp.user_id = auth.uid() AND mp.module = 'ip' AND mp.can_manage = true)
      OR owner = auth.uid()
      OR owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.ip_allocations a
        WHERE a.ip_id = ip_assets.id
          AND a.assignee_user_id = auth.uid()
          AND a.state = 'allocated'
          AND a.released_at IS NULL
          AND COALESCE(a.deleted_at IS NULL, true)
      )
      OR EXISTS (
        SELECT 1 FROM public.resource_assignments ra
        WHERE ra.resource_type = 'ip_asset'
          AND ra.resource_id = ip_assets.id
          AND ra.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS ip_allocations_select ON public.ip_allocations;
DROP POLICY IF EXISTS ip_allocations_select_assignee ON public.ip_allocations;
DROP POLICY IF EXISTS "Users can view IP allocations based on permissions" ON public.ip_allocations;

CREATE POLICY ip_allocations_select_scoped ON public.ip_allocations
  FOR SELECT TO authenticated
  USING (
    COALESCE(deleted_at IS NULL, true) AND (
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
      OR EXISTS (SELECT 1 FROM public.module_permissions mp WHERE mp.user_id = auth.uid() AND mp.module = 'ip' AND mp.can_manage = true)
      OR owner = auth.uid()
      OR assignee_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.resource_assignments ra
        WHERE ra.resource_type = 'ip_allocation'
          AND ra.resource_id = ip_allocations.id
          AND ra.user_id = auth.uid()
      )
    )
  );
