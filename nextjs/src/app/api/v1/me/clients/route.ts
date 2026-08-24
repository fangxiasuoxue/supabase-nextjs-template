import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { listGrantedResourceIds } from '@/lib/auth/resourceAccess'

// SDD 55 · P2a —— 端用户门户数据源:返回「当前登录用户被授权(node_client)的 client」。
// 作用域 = auth.uid() 的 access_grants(node_client);经 service_role 取 node_clients 明细,
// 只回端用户需要的字段(不泄漏父 node 拓扑,见 E1)。前端据 subscribe_token 拼 /s/<token>。
export async function GET() {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 该用户被授权的 client id 集合(P1b helper)。
  const ids = await listGrantedResourceIds(user.id, 'node_client', 'read')
  if (ids.length === 0) return NextResponse.json({ clients: [] })

  const admin = await createServerAdminClient()
  const { data, error: qErr } = await (admin as any)
    .from('node_clients')
    .select('id, label, email, subscribe_token, enabled, expires_at')
    .in('id', ids)
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // 只回端用户字段;不含 node_id/inbound_tag 等拓扑。
  const clients = (data ?? []).map((c: any) => ({
    id: c.id,
    label: c.label ?? null,
    email: c.email ?? null,
    enabled: !!c.enabled,
    expires_at: c.expires_at ?? null,
    token: c.subscribe_token ?? null,
  }))
  return NextResponse.json({ clients })
}
