import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// ────────────────────────────────────────────────────────────────────────────
// SDD 55 · P1b —— 资源级能力判定(access_grants + level)。
//
// 归属/能力真相 = access_grants(resource_type, resource_id, user_id, level)。
// 分级序:read < write < manage。admin / ops(user_roles.role)全局旁路。
//
// 用途(P2 接线):
//   · hasResourceAccess:写/操作类路由的门(如「对该 node 是否有 write」)。
//   · listGrantedResourceIds:列表类按用户授权集合过滤(不是逐条 403)。
//   · userGrantLevel:取某用户对某资源的级别,用于 UI 显隐/护栏文案。
//
// 注:VPS 仍走 vps_allocations(P3 统一后 resource_type='vps' 才纳入本 helper)。
// 本模块用 service_role(createServerAdminClient)读,绕 RLS——它是「路由层的门」,
// RLS 是「DB 层的兜底」,两者独立。
// ────────────────────────────────────────────────────────────────────────────

export type ResourceType = 'node' | 'node_client' | 'vps'
export type GrantLevel = 'read' | 'write' | 'manage'

const ORDER: Record<GrantLevel, number> = { read: 1, write: 2, manage: 3 }

export function levelGte(a: GrantLevel, min: GrantLevel): boolean {
  return ORDER[a] >= ORDER[min]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isGlobalOperator(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  const role = (data as { role?: string } | null)?.role
  return role === 'admin' || role === 'ops'
}

/** 取某用户对某资源的授权级别;无授权返回 null(不含 admin/ops 旁路——那是全局,单独判)。 */
export async function userGrantLevel(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<GrantLevel | null> {
  const admin = await createServerAdminClient()
  const { data } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('access_grants' as any)
    .select('level')
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .maybeSingle()
  return ((data as { level?: GrantLevel } | null)?.level) ?? null
}

/** 用户对该资源是否有 ≥ minLevel 的能力(admin/ops 全局旁路)。 */
export async function hasResourceAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  minLevel: GrantLevel,
): Promise<boolean> {
  const admin = await createServerAdminClient()
  if (await isGlobalOperator(admin, userId)) return true
  const { data } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('access_grants' as any)
    .select('level')
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .maybeSingle()
  const lvl = (data as { level?: GrantLevel } | null)?.level
  return !!lvl && levelGte(lvl, minLevel)
}

// ── 路由门 ─────────────────────────────────────────────────────────────────
// requireNodeAccess:替代各 node 相关 admin 路由的 requireOps —— admin/ops 旁路,
// 否则要求登录用户对该 node 有 ≥ minLevel 的 access_grants(node)。per-node 判定。
// 用法:const gate = await requireNodeAccess(nodeId, 'write'); if ('error' in gate) return gate.error
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireNodeAccess(
  nodeId: string,
  minLevel: GrantLevel,
): Promise<{ user: { id: string } } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  // hasResourceAccess 内含 admin/ops 全局旁路。
  if (await hasResourceAccess(user.id, 'node', nodeId, minLevel)) {
    return { user: { id: user.id } }
  }
  return { error: NextResponse.json({ error: `Forbidden(需对该节点有 ${minLevel} 权限)` }, { status: 403 }) }
}

// requireSeatAccess:seat(node_client)操作路由用 —— 先查 seat 所属 node,再按 node 判级。
export async function requireSeatAccess(
  seatId: string,
  minLevel: GrantLevel,
): Promise<{ user: { id: string } } | { error: NextResponse }> {
  const admin = await createServerAdminClient()
  const { data: seat } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('node_clients' as any)
    .select('node_id')
    .eq('id', seatId)
    .maybeSingle()
  const nodeId = (seat as { node_id?: string } | null)?.node_id
  if (!nodeId) {
    return { error: NextResponse.json({ error: 'Client not found' }, { status: 404 }) }
  }
  return requireNodeAccess(nodeId, minLevel)
}

// ── VPS 授权(P3a 统一后:读 access_grants(resource_type='vps'))──
// D1 统一:VPS 并入 access_grants,与 node 同一张真相表。level 语义(§3.2):
//   write = 可作部署目标(R1 创建部署需此);manage = VPS 生命周期(admin/ops 旁路,不依赖此行)。
// 归属真相 = access_grants('vps', vps_id, user, level);vps_allocations 保留作审计,
// 由 vps.ts allocate/release 双写镜像到本表(migration 20260824000004 回填历史分配)。

/** 列出某用户被授权(level≥minLevel,默认 write=可部署)的 VPS id(不含 admin/ops 旁路)。 */
export async function listGrantedVpsIds(userId: string, minLevel: GrantLevel = 'write'): Promise<string[]> {
  return listGrantedResourceIds(userId, 'vps', minLevel)
}

/** 用户对某 VPS 是否有 ≥minLevel(默认 write)授权(admin/ops 全局旁路)。创建部署的门(R1)。 */
export async function hasVpsAccess(userId: string, vpsId: string, minLevel: GrantLevel = 'write'): Promise<boolean> {
  return hasResourceAccess(userId, 'vps', vpsId, minLevel)
}

/** 用户是否持有任一可部署 VPS(level≥write,不含 admin/ops 旁路)。护栏文案(R2)用。 */
export async function userHasAnyVps(userId: string): Promise<boolean> {
  const ids = await listGrantedVpsIds(userId, 'write')
  return ids.length > 0
}

/** 幂等授予:让某用户对某资源拥有 ≥level(不降级已有更高/同级)。部署自动授权 R4 / VPS 分配镜像用。 */
export async function grantResourceAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  level: GrantLevel,
  grantedBy?: string,
): Promise<void> {
  const admin = await createServerAdminClient()
  const existing = await userGrantLevel(userId, resourceType, resourceId)
  if (existing && levelGte(existing, level)) return // 不降级
  await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('access_grants' as any)
    .upsert(
      { user_id: userId, resource_type: resourceType, resource_id: resourceId, level, granted_by: grantedBy ?? userId },
      { onConflict: 'resource_type,resource_id,user_id' },
    )
}

/** 撤销某用户对某资源的授权(删授权行)。VPS 回收镜像(release)用。 */
export async function revokeResourceAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<void> {
  const admin = await createServerAdminClient()
  await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('access_grants' as any)
    .delete()
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
}

/** 幂等授予:让某用户对某 node 拥有 manage(部署成功后自动授权 R4)。已存在更高/同级则不降级。 */
export async function grantNodeAccess(
  userId: string,
  nodeId: string,
  level: GrantLevel = 'manage',
): Promise<void> {
  return grantResourceAccess(userId, 'node', nodeId, level)
}

/** 列出某用户被授权(≥ minLevel)的资源 id 集合,用于列表类过滤。 */
export async function listGrantedResourceIds(
  userId: string,
  resourceType: ResourceType,
  minLevel: GrantLevel = 'read',
): Promise<string[]> {
  const admin = await createServerAdminClient()
  const { data } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('access_grants' as any)
    .select('resource_id, level')
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
  const rows = (data ?? []) as unknown as Array<{ resource_id: string; level: GrantLevel }>
  return rows
    .filter((r) => levelGte(r.level, minLevel))
    .map((r) => r.resource_id)
}
