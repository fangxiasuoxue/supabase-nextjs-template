import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { sanitizeNodeUpdate, buildDeleteDeployment } from '@/lib/nodes/node-lifecycle'

// 权限门:admin/ops。返回 user 或 null(已写好错误响应)。
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

// DELETE /api/v1/admin/nodes/[id] — 下发删除:建 task_type=delete 部署 + node→suspended。
// agent poller 会去机器上拆 inbound;成功后 result 路由把 node 置 deleted(见 node-lifecycle)。
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const admin = await createServerAdminClient()

  const { data: node } = await admin.from('nodes').select('id, status').eq('id', id).maybeSingle()
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  if ((node as any).status === 'deleted') {
    return NextResponse.json({ error: '节点已删除' }, { status: 409 })
  }

  const { data: dep, error: depErr } = await admin
    .from('node_deployments')
    .insert(buildDeleteDeployment(id) as any)
    .select('id')
    .single()
  if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 })

  // 标记为 suspended(下线中/待拆);agent 成功后转 deleted。
  await admin.from('nodes').update({ status: 'suspended' }).eq('id', id)

  return NextResponse.json({ data: { node_id: id, deployment_id: (dep as any).id } }, { status: 202 })
}

// PATCH /api/v1/admin/nodes/[id] — 修改节点元数据(v1 仅白名单字段,见 node-lifecycle)。
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const s = sanitizeNodeUpdate(body)
  if ('error' in s) return NextResponse.json({ error: s.error }, { status: 400 })

  const admin = await createServerAdminClient()
  const { data, error } = await admin.from('nodes').update(s.patch as any).eq('id', id).select('id, name, status').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  return NextResponse.json({ data })
}
