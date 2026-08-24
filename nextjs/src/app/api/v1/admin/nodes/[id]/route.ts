import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { sanitizeNodeUpdate, buildDeleteDeployment } from '@/lib/nodes/node-lifecycle'

// SDD 55 P2b/P2c 权限门:PATCH 节点级配额/到期=write、改名等元数据=manage;
// DELETE 节点(生命周期)=manage。admin/ops 旁路。删节点护栏(有 seat / 无 VPS)见 P2c 前端。

// DELETE /api/v1/admin/nodes/[id] — 下发删除:建 task_type=delete 部署 + node→suspended。
// agent poller 会去机器上拆 inbound;成功后 result 路由把 node 置 deleted(见 node-lifecycle)。
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'manage')
  if ('error' in gate) return gate.error
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
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  // 节点级总控制(数值/可空,不走字符串 sanitizer):node_quota_bytes(总流量池)、node_expires_at(节点到期)。
  const { node_quota_bytes, node_expires_at, ...rest } = body ?? {}
  // SDD 55:仅改节点级配额/到期=write;改名等元数据(rest,如 name)=manage(节点生命周期)。
  const needsManage = Object.keys(rest).length > 0
  const gate = await requireNodeAccess(id, needsManage ? 'manage' : 'write')
  if ('error' in gate) return gate.error
  const patch: Record<string, unknown> = {}
  if (node_quota_bytes !== undefined) {
    if (node_quota_bytes === null || Number(node_quota_bytes) <= 0) patch.node_quota_bytes = null
    else {
      const q = Number(node_quota_bytes)
      if (!Number.isFinite(q)) return NextResponse.json({ error: 'node_quota_bytes 非法' }, { status: 400 })
      patch.node_quota_bytes = Math.trunc(q)
    }
  }
  if (node_expires_at !== undefined) {
    patch.node_expires_at = node_expires_at === null || !String(node_expires_at).trim() ? null : String(node_expires_at)
  }
  // 其余字段(name 等)走原字符串 sanitizer
  if (Object.keys(rest).length > 0) {
    const s = sanitizeNodeUpdate(rest)
    if ('error' in s) return NextResponse.json({ error: s.error }, { status: 400 })
    Object.assign(patch, s.patch)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 })

  const admin = await createServerAdminClient()
  const { data, error } = await admin.from('nodes').update(patch as any).eq('id', id).select('id, name, status').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  return NextResponse.json({ data })
}
