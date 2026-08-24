import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

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
