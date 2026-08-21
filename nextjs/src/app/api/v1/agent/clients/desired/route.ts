import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { buildDesiredResponse, type NodeClientRow } from '@/lib/clients/node-client-desired'
import crypto from 'crypto'

// POST /api/v1/agent/clients/desired
// agent poller 拉取"属于本 instance 的终端(seat)期望态全集"。HMAC 鉴权同 register/sync/deployments。
// 设计依据:docs/current/51-node-terminal-access-traffic-sdd.md §11.2。
// 返回每个终端的 {node_id, inbound_tag, email, cred(vless uuid), enabled, expires_at, enrolled, ...};
// agent 据此 reconcile:enrolled 且不在运行态→AddUser,在运行态但离册→RemoveUser。

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  if (typeof hmac !== 'string' || !/^[0-9a-fA-F]+$/.test(hmac)) return false
  const expected = crypto.createHmac('sha256', HEARTBEAT_SECRET).update(`${instanceId}:${timestamp}`).digest('hex')
  const expBuf = Buffer.from(expected, 'hex')
  const gotBuf = Buffer.from(hmac, 'hex')
  if (expBuf.length !== gotBuf.length) return false
  return crypto.timingSafeEqual(expBuf, gotBuf)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { instance_id, timestamp, hmac } = body
  if (!instance_id || !timestamp || !hmac) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 60) {
    return NextResponse.json({ error: 'Timestamp out of window' }, { status: 401 })
  }
  if (!verifyHmac(instance_id, timestamp, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }

  const admin = await createServerAdminClient()

  // instance_id -> vps_instances(与 register/deployments 一致)
  const { data: vps } = await admin
    .from('vps_instances')
    .select('id')
    .or(`gcp_instance_name.eq.${instance_id},name.eq.${instance_id}`)
    .limit(1)
    .maybeSingle()
  if (!vps) {
    return NextResponse.json({ error: 'Unknown instance_id' }, { status: 404 })
  }

  // 该 VPS 的节点(拿 inbound_tag 供 agent 定位 inbound;node_expires_at/node_quota_bytes 供节点级总门)
  const { data: nodes } = await admin
    .from('nodes')
    .select('id, inbound_tag, node_expires_at, node_quota_bytes')
    .eq('vps_instance_id', vps.id)
  const nodeIds = (nodes || []).map((n: any) => n.id)
  if (nodeIds.length === 0) return NextResponse.json({ clients: [] })

  const inboundTagByNode = new Map<string, string | null>(
    (nodes || []).map((n: any) => [n.id, n.inbound_tag ?? null]),
  )

  const { data: rows } = await admin
    .from('node_clients')
    .select('node_id, email, cred_ref, protocol, enabled, expires_at, ip_limit, quota_bytes, quota_period, period_started_at, over_action, used_bytes')
    .in('node_id', nodeIds)
    .order('created_at', { ascending: true })

  // 节点级总门:节点到期 或 该节点全终端 used_bytes 合计 ≥ node_quota_bytes → 该节点全部终端强制离册。
  // used_bytes 用 console 回灌镜像(滞后一个 clientsync 周期,粗粒度节点总量足够)。
  const nodeUsed = new Map<string, number>()
  for (const r of (rows || []) as any[]) {
    nodeUsed.set(r.node_id, (nodeUsed.get(r.node_id) ?? 0) + (Number(r.used_bytes) || 0))
  }
  const gatedNodeIds = new Set<string>()
  for (const n of (nodes || []) as any[]) {
    const expired = n.node_expires_at != null && !Number.isNaN(Date.parse(n.node_expires_at)) && now >= Math.floor(Date.parse(n.node_expires_at) / 1000)
    const overQuota = n.node_quota_bytes != null && Number(n.node_quota_bytes) > 0 && (nodeUsed.get(n.id) ?? 0) >= Number(n.node_quota_bytes)
    if (expired || overQuota) gatedNodeIds.add(n.id)
  }

  const res = buildDesiredResponse((rows || []) as NodeClientRow[], inboundTagByNode, now, gatedNodeIds)
  return NextResponse.json(res)
}
