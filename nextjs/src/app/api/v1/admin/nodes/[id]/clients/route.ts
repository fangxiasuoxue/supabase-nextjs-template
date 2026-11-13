import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { nodeSlug, buildSeatEmail, buildSeatShareLink, toSeatProtocol, generateSeatCredential, splitSocksCredential } from '@/lib/clients/node-client-admin'
import { loadSeatLinkNode } from '@/lib/clients/seat-link-context'

// 终端(seat)管理:某 node 下的名额列表 / 批量发名额。
// 设计依据:docs/current/51 §11.4 · SDD 55 P2b。
// 权限门:GET=对该 node 有 read;POST(发名额)=对该 node 有 write。admin/ops 旁路。

// GET /api/v1/admin/nodes/[id]/clients — 列出该 node 的终端。
// 返回每终端的直连链接:share_url(按节点协议:vless 换 uuid / SS 由节点字段拼 SIP002 / socks 拼 socks://),
// 并保留 vless_url(仅 vless)、ss_url(仅 SS)、socks_url(仅 socks)协议专用字段。
// cred_ref 不作为独立字段返回;socks 席位额外给 socks_account {user,pass}(R-012:用户要能直接看到/复制随机账密,
// 浏览器/AdsPower 类客户端填的是账密而不是链接)。
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'read')
  if ('error' in gate) return gate.error
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_clients')
    .select('id, node_id, email, protocol, purpose, label, enabled, expires_at, ip_limit, subscribe_token, last_reconciled_at, last_reconcile_error, quota_bytes, quota_period, over_action, period_started_at, used_bytes, outbound_id, outbound_tag, outbound_config, cred_ref, created_at')
    .eq('node_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 节点级总控制字段(供页面显示/编辑)
  const { data: nodeMeta } = await admin
    .from('nodes')
    .select('node_quota_bytes, node_expires_at')
    .eq('id', id)
    .maybeSingle()

  // 节点上下文(协议 / 公网地址 / 端口 / SS method / vless base 链接)→ 每终端按协议生成直连链接。
  const linkNode = await loadSeatLinkNode(admin, id)
  const clients = (data ?? []).map((c: any) => {
    const { cred_ref, ...rest } = c
    const share_url = buildSeatShareLink(linkNode, { cred_ref, label: c.label, email: c.email })
    const vless_url = share_url && share_url.startsWith('vless://') ? share_url : null
    const ss_url = share_url && share_url.startsWith('ss://') ? share_url : null
    const socks_url = share_url && share_url.startsWith('socks://') ? share_url : null
    const socks_account = toSeatProtocol(c.protocol) === 'socks' ? splitSocksCredential(cred_ref) : null
    return { ...rest, share_url, vless_url, ss_url, socks_url, socks_account }
  })
  return NextResponse.json({ clients, node: nodeMeta ?? null })
}

// POST /api/v1/admin/nodes/[id]/clients — 批量发 N 个名额(默认 1)。
// body: { count?, label?, expires_at?, ip_limit?, quota_bytes?, outbound_id? }
// 批量时 expires_at/quota_bytes/outbound 对本批全部名额施加。
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
  const { data: node } = await admin.from('nodes').select('id, name, protocol, vps_instance_id').eq('id', id).maybeSingle()
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  let outbound: { id: string; tag: string } | null = null
  if (body?.outbound_id) {
    const { data } = await (admin as any).from('node_outbounds')
      .select('id,tag,target_vps_instance_id,desired_state,deploy_state')
      .eq('id', String(body.outbound_id)).maybeSingle()
    if (!data || data.target_vps_instance_id !== (node as any).vps_instance_id || data.desired_state === 'absent' || data.deploy_state !== 'active') {
      return NextResponse.json({ error: '所选出口不属于该节点 VPS、已移除或尚未 Apply 生效' }, { status: 400 })
    }
    outbound = { id: data.id, tag: data.tag }
  }

  // 现有名额数 → 计算下一 seq(避免 email 撞车)
  const { count: existing } = await admin
    .from('node_clients')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', id)
  const slug = nodeSlug((node as any).name)
  // 席位协议 = DB 词表('ss' 而非节点的 'shadowsocks'),否则触发 node_clients_protocol_check 插入失败(R-010 (a))。
  const protocol = toSeatProtocol((node as any).protocol)

  const rows = Array.from({ length: count }, (_, i) => {
    const seq = (existing ?? 0) + i + 1
    return {
      node_id: id,
      email: buildSeatEmail(slug, seq),
      cred_ref: generateSeatCredential(protocol), // P1:直接存凭据(vless uuid / SS 随机密码;DB 运行态,非 git)
      protocol,
      purpose: 'user',
      label,
      enabled: true,
      expires_at: expiresAt,
      ip_limit: ipLimit,
      quota_bytes: quotaBytes,
      outbound_id: outbound?.id ?? null,
      outbound_tag: outbound?.tag ?? null,
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
