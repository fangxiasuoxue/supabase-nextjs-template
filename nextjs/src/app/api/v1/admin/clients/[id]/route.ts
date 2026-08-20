import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// 单个终端(seat)的启停 / 续期 / 限并发 / 删除。设计依据:docs/current/51 §11.4。
// 删除是硬删:agent reconcile 据本地账本会把对应 xray user RemoveUser(§11.3)。

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

// PATCH /api/v1/admin/clients/[id] — body: { enabled?, expires_at?, ip_limit?, label? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, any> = {}
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled
  if (body?.expires_at !== undefined) patch.expires_at = body.expires_at === null ? null : String(body.expires_at)
  if (body?.ip_limit !== undefined)
    patch.ip_limit = body.ip_limit === null ? null : Math.max(0, parseInt(body.ip_limit, 10) || 0)
  if (body?.label !== undefined) patch.label = body.label === null ? null : String(body.label).slice(0, 200)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  }

  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .update(patch as any)
    .eq('id', id)
    .select('id, email, enabled, expires_at, ip_limit, label')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json({ client: data })
}

// DELETE /api/v1/admin/clients/[id] — 硬删名额(agent 下轮 reconcile 会 RemoveUser)。
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json({ ok: true, id: (data as any).id })
}
