import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireSeatAccess } from '@/lib/auth/resourceAccess'

// 单个终端(seat)的启停 / 续期 / 限并发 / 删除。设计依据:docs/current/51 §11.4 · SDD 55 P2b。
// 权限门:对该 seat 所属 node 有 write(admin/ops 旁路)。硬删见 §11.3(agent RemoveUser)。

// PATCH /api/v1/admin/clients/[id]
//   body: { enabled?, expires_at?, ip_limit?, label?,
//           quota_bytes?, quota_period?, over_action?, roll_period? }
// P2e:quota_bytes/quota_period/over_action 为配额期望态(agent /clients/desired 下发,本地账本执行)。
//   roll_period=true → 滚动周期起点(period_started_at=now)+ 归零 used_bytes 镜像:
//   agent 见新 period 即开新账本行(used=0)并恢复被配额停用的终端(§12.3)。
const OVER_ACTIONS = new Set(['disable', 'throttle', 'alert'])
const QUOTA_PERIODS = new Set(['monthly', 'custom'])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireSeatAccess(id, 'write')
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, any> = {}
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled
  if (body?.expires_at !== undefined) patch.expires_at = body.expires_at === null ? null : String(body.expires_at)
  if (body?.ip_limit !== undefined)
    patch.ip_limit = body.ip_limit === null ? null : Math.max(0, parseInt(body.ip_limit, 10) || 0)
  if (body?.label !== undefined) patch.label = body.label === null ? null : String(body.label).slice(0, 200)

  // 配额字段
  if (body?.quota_bytes !== undefined) {
    if (body.quota_bytes === null) patch.quota_bytes = null
    else {
      const q = Number(body.quota_bytes)
      if (!Number.isFinite(q) || q < 0) {
        return NextResponse.json({ error: 'quota_bytes 必须 >=0 或 null' }, { status: 400 })
      }
      patch.quota_bytes = Math.trunc(q)
    }
  }
  if (body?.quota_period !== undefined) {
    if (!QUOTA_PERIODS.has(body.quota_period)) {
      return NextResponse.json({ error: 'quota_period 须 monthly/custom' }, { status: 400 })
    }
    patch.quota_period = body.quota_period
  }
  if (body?.over_action !== undefined) {
    if (!OVER_ACTIONS.has(body.over_action)) {
      return NextResponse.json({ error: 'over_action 须 disable/throttle/alert' }, { status: 400 })
    }
    patch.over_action = body.over_action
  }
  if (body?.roll_period === true) {
    patch.period_started_at = new Date().toISOString()
    patch.used_bytes = 0 // 镜像归零;真正执行看 agent 见新 period 后开新账本
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  }

  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .update(patch as any)
    .eq('id', id)
    .select('id, email, enabled, expires_at, ip_limit, label, quota_bytes, quota_period, over_action, period_started_at, used_bytes')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json({ client: data })
}

// DELETE /api/v1/admin/clients/[id] — 硬删名额(agent 下轮 reconcile 会 RemoveUser)。
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireSeatAccess(id, 'write')
  if ('error' in gate) return gate.error
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
