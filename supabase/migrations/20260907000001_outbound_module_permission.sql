-- SDD64: Outbound 独立模块权限。默认无权限；admin/ops 由应用层旁路。
ALTER TABLE public.module_permissions
  DROP CONSTRAINT IF EXISTS module_permissions_module_check;

ALTER TABLE public.module_permissions
  ADD CONSTRAINT module_permissions_module_check
  CHECK (module IN ('vps','nodes','ip','orders','messages','domain','transit','outbound'));

COMMENT ON COLUMN public.module_permissions.module IS
  'Console module key; outbound controls the global Outbound catalog/workspace independently from nodes.';
