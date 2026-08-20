import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { nodeSlug, buildSeatEmail } from '@/lib/clients/node-client-admin'

// 终端(seat)管理:某 node 下的名额列表 / 批量发名额。
// 设计依据:docs/current/51 §11.4。权限门 admin/ops(同其它 admin 路由)。

async function requireOps(): Promise<{ user: any } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  if (!role || !['admin', 'ops'].includes((role as any).role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

// GET /api/v1/admin/nodes/[id]/clients — 列出该 node 的终端(不回 cred 明文)。
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .select('id, node_id, email, protocol, label, enabled, expires_at, ip_limit, subscribe_token, last_reconciled_at, last_reconcile_error, quota_bytes, quota_period, over_action, period_started_at, used_bytes, created_at')
    .eq('node_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}

// POST /api/v1/admin/nodes/[id]/clients — 批量发 N 个名额(默认 1)。
// body: { count?, label?, expires_at?, ip_limit? }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const count = Math.min(Math.max(parseInt(body?.count ?? 1, 10) || 1, 1), 50) // 1..50 上限防误操作
  const label: string | null = body?.label ? String(body.label).slice(0, 200) : null
  const expiresAt: string | null = body?.expires_at ? String(body.expires_at) : null
  const ipLimit: number | null =
    body?.ip_limit === undefined || body?.ip_limit === null ? null : Math.max(0, parseInt(body.ip_limit, 10) || 0)

  const admin = await createServerAdminClient()

  // node 存在性 + 取 name/protocol 供 email/协议派生
  const { data: node } = await admin.from('nodes').select('id, name, protocol').eq('id', id).maybeSingle()
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  // 现有名额数 → 计算下一 seq(避免 email 撞车)
  const { count: existing } = await admin
    .from('node_clients')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', id)
  const slug = nodeSlug((node as any).name)
  const protocol = (node as any).protocol || 'vless'

  const rows = Array.from({ length: count }, (_, i) => {
    const seq = (existing ?? 0) + i + 1
    return {
      node_id: id,
      email: buildSeatEmail(slug, seq),
      cred_ref: randomUUID(), // P1:直接存 vless uuid(DB 运行态,非 git)
      protocol,
      label,
      enabled: true,
      expires_at: expiresAt,
      ip_limit: ipLimit,
      subscribe_token: randomBytes(24).toString('hex'), // 48 hex = 192bit
      created_by: gate.user.id,
    }
  })

  const { data, error } = await admin
    .from('node_clients')
    .insert(rows as any)
    .select('id, email, subscribe_token, enabled, expires_at, ip_limit')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data ?? [] }, { status: 201 })
}
