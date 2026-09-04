import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { nodeSlug, buildSeatEmail, swapVlessUuid, extractBaseShareLink } from '@/lib/clients/node-client-admin'

// 终端(seat)管理:某 node 下的名额列表 / 批量发名额。
// 设计依据:docs/current/51 §11.4 · SDD 55 P2b。
// 权限门:GET=对该 node 有 read;POST(发名额)=对该 node 有 write。admin/ops 旁路。

// GET /api/v1/admin/nodes/[id]/clients — 列出该 node 的终端。
// 返回每终端的 vless_url(直接连接链接;admin 管理需要,uuid 本就是 vless 链接必含的凭据)。
// cred_ref 仅服务端用于拼 vless_url,不作为独立字段返回。
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'read')
  if ('error' in gate) return gate.error
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .select('id, node_id, email, protocol, label, enabled, expires_at, ip_limit, subscribe_token, last_reconciled_at, last_reconcile_error, quota_bytes, quota_period, over_action, period_started_at, used_bytes, outbound_tag, outbound_config, cred_ref, created_at')
    .eq('node_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 节点级总控制字段(供页面显示/编辑)
  const { data: nodeMeta } = await admin
    .from('nodes')
    .select('node_quota_bytes, node_expires_at')
    .eq('id', id)
    .maybeSingle()

  // 取该 node 最新 rendered_config 的 base vless 链接,给每终端换 uuid 生成 vless_url。
  const base = await fetchNodeBaseLink(admin, id)
  const clients = (data ?? []).map((c: any) => {
    const { cred_ref, ...rest } = c
    let vless_url: string | null = null
    if (base && cred_ref) {
      try {
        vless_url = swapVlessUuid(base, cred_ref, c.label || c.email)
      } catch {
        vless_url = null
      }
    }
    return { ...rest, vless_url }
  })
  return NextResponse.json({ clients, node: nodeMeta ?? null })
}

// 取某 node 最新带 rendered_config 部署里的 base vless 链接(容错;取不到返回 null)。
async function fetchNodeBaseLink(admin: any, nodeId: string): Promise<string | null> {
  const { data } = await admin
    .from('node_deployments')
    .select('rendered_config, created_at')
    .eq('node_id', nodeId)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return extractBaseShareLink(data?.rendered_config)
}

// POST /api/v1/admin/nodes/[id]/clients — 批量发 N 个名额(默认 1)。
// body: { count?, label?, expires_at?, ip_limit?, quota_bytes? }
// 批量时 expires_at/quota_bytes 对本批全部名额施加同一到期与同一配额。
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'write')
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const count = Math.min(Math.max(parseInt(body?.count ?? 1, 10) || 1, 1), 50) // 1..50 上限防误操作
  const label: string | null = body?.label ? String(body.label).slice(0, 200) : null
  const expiresAt: string | null = body?.expires_at ? String(body.expires_at) : null
  const ipLimit: number | null =
    body?.ip_limit === undefined || body?.ip_limit === null ? null : Math.max(0, parseInt(body.ip_limit, 10) || 0)
  const quotaBytes: number | null =
    body?.quota_bytes === undefined || body?.quota_bytes === null || Number(body.quota_bytes) <= 0
      ? null
      : Math.trunc(Number(body.quota_bytes))

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
      quota_bytes: quotaBytes,
      period_started_at: quotaBytes != null ? new Date().toISOString() : null,
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
