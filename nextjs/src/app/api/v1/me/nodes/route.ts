import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { listGrantedResourceIds } from '@/lib/auth/resourceAccess'

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
    .select('id, name, protocol, status, inbound_tag, created_at')
    .in('id', ids)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  const nodes = (data ?? []).map((n: any) => ({
    id: n.id,
    name: n.name ?? null,
    protocol: n.protocol ?? null,
    status: n.status,
    inbound_tag: n.inbound_tag ?? null,
    created_at: n.created_at,
    level: levelById.get(n.id) ?? 'read',
  }))
  return NextResponse.json({ nodes })
}
