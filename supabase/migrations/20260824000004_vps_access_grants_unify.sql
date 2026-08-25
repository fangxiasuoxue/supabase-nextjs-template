-- SDD 55 · P3a —— VPS 授权统一进 access_grants(resource_type='vps')。D1 统一:四套授权收敛为一套。
-- 背景:VPS 授权原走 vps_allocations(owner/assigned_to + state)。现镜像进 access_grants,
--   与 node/node_client 同一真相表,helper(hasVpsAccess/listGrantedVpsIds)统一读此表。
-- level 语义(§3.2):write=可作部署目标(R1 创建部署需此);manage=VPS 生命周期(admin/ops 旁路,不依赖此行)。
-- 幂等:ON CONFLICT DO NOTHING(唯一键 resource_type,resource_id,user_id)。
-- vps_allocations 保留作审计+回滚,由 vps.ts allocate/release 双写保持一致;P4 再决定是否退役。

-- 注:vps_allocations.assigned_to 为 text(存 uuid 字符串),需 ::uuid 转型;vps_id/owner 本已 uuid。
-- 1) 回填历史 allocated 分配 → access_grants('vps', vps_id, assigned_to, 'write')
INSERT INTO access_grants (resource_type, resource_id, user_id, level, granted_by)
SELECT DISTINCT 'vps', a.vps_id, a.assigned_to::uuid, 'write', a.owner
FROM vps_allocations a
WHERE a.state = 'allocated' AND a.assigned_to IS NOT NULL AND a.assigned_to <> ''
ON CONFLICT (resource_type, resource_id, user_id) DO NOTHING;

-- 2) owner ≠ assigned_to 时,owner(归属人)也镜像 write
INSERT INTO access_grants (resource_type, resource_id, user_id, level, granted_by)
SELECT DISTINCT 'vps', a.vps_id, a.owner, 'write', a.owner
FROM vps_allocations a
WHERE a.state = 'allocated' AND a.owner IS NOT NULL
  AND (a.assigned_to IS NULL OR a.owner <> a.assigned_to::uuid)
ON CONFLICT (resource_type, resource_id, user_id) DO NOTHING;

-- 3) vps_instances SELECT RLS 增 access_grants('vps') 分支(纵深:部署表单按授权显 VPS)。
--    保留既有 allocation/module 分支作过渡兜底;grant 为新增可见性来源(additive OR)。
DROP POLICY IF EXISTS "vps_instances_select" ON public.vps_instances;
CREATE POLICY "vps_instances_select"
  ON public.vps_instances FOR SELECT
  USING (
    public.is_admin()
    OR public.has_module_permission('vps', 'read')
    OR EXISTS (
      SELECT 1 FROM public.vps_allocations
      WHERE vps_allocations.vps_id = vps_instances.id
        AND vps_allocations.owner = auth.uid()
        AND vps_allocations.state = 'allocated'
    )
    OR EXISTS (
      SELECT 1 FROM public.access_grants g
      WHERE g.resource_type = 'vps'
        AND g.resource_id = vps_instances.id
        AND g.user_id = auth.uid()
    )
  );
