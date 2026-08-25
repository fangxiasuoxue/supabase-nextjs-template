import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { listGrantedResourceIds, listGrantedVpsIds } from '@/lib/auth/resourceAccess'

// SDD 55 · P2b —— 二级代理视图数据源:返回「当前登录用户被授权(node)的节点」+ 其级别。
// 作用域 = auth.uid() 的 access_grants(node);经 service_role 取 nodes 明细。
// level 决定前端可用操作(read 看 / write 管终端 / manage 生命周期)。
export async function GET() {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ids = await listGrantedResourceIds(user.id, 'node', 'read')
  if (ids.length === 0) return NextResponse.json({ nodes: [] })

  const admin = await createServerAdminClient()
  // 该用户对这些 node 的级别(id → level)。
  const { data: grants } = await (admin as any)
    .from('access_grants')
    .select('resource_id, level')
    .eq('user_id', user.id)
    .eq('resource_type', 'node')
  const levelById = new Map<string, string>(
    (grants ?? []).map((g: any) => [g.resource_id, g.level]),
  )

  const { data, error: qErr } = await (admin as any)
    .from('nodes')
    .select('id, name, protocol, status, inbound_tag, vps_instance_id, created_at')
    .in('id', ids)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // SDD 55 · P3b/R3 —— 反向依赖:该用户是否对每个 node 所在 VPS 有 write(可重部署)。
  // 无 → 前端节点行打标「⚠ 无 VPS」(撤销 VPS 授权/回收后此节点不可重部署)。管理员集合读一次。
  const vpsIds = new Set(await listGrantedVpsIds(user.id, 'write'))

  const nodes = (data ?? []).map((n: any) => ({
    id: n.id,
    name: n.name ?? null,
    protocol: n.protocol ?? null,
    status: n.status,
    inbound_tag: n.inbound_tag ?? null,
    created_at: n.created_at,
    level: levelById.get(n.id) ?? 'read',
    // 该 node 所在 VPS 是否被授权(可重部署);无 vps_instance_id 视为未知→false。
    vpsOk: !!n.vps_instance_id && vpsIds.has(n.vps_instance_id),
  }))
  return NextResponse.json({ nodes })
}
