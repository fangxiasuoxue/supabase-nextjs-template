import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import crypto from 'crypto'

// POST /api/v1/agent/clients/result
// agent 完成一轮 reconcile 后回报实际生效态。HMAC 鉴权同 desired。
// 设计依据:docs/current/51-node-terminal-access-traffic-sdd.md §11.2/§11.3。
// P1:校验 + ack + 回填每个终端的 last_reconciled_at / 最近错误(便于后台看下发是否落地)。
// 更丰富的用量回填(used_bytes/over_quota)见 P2。

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  if (typeof hmac !== 'string' || !/^[0-9a-fA-F]+$/.test(hmac)) return false
  const expected = crypto.createHmac('sha256', HEARTBEAT_SECRET).update(`${instanceId}:${timestamp}`).digest('hex')
  const expBuf = Buffer.from(expected, 'hex')
  const gotBuf = Buffer.from(hmac, 'hex')
  if (expBuf.length !== gotBuf.length) return false
  return crypto.timingSafeEqual(expBuf, gotBuf)
}

interface AppliedItem {
  node_id?: string
  email?: string
  state?: string // added | removed | unchanged | error
  error?: string
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { instance_id, timestamp, hmac } = body
  const applied: AppliedItem[] = Array.isArray(body?.applied) ? body.applied : []
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

  // 解析 instance -> vps -> node ids(限定回报只能落到本 instance 的节点,防越权改他机终端)
  const { data: vps } = await admin
    .from('vps_instances')
    .select('id')
    .or(`gcp_instance_name.eq.${instance_id},name.eq.${instance_id}`)
    .limit(1)
    .maybeSingle()
  if (!vps) return NextResponse.json({ error: 'Unknown instance_id' }, { status: 404 })

  const { data: nodes } = await admin.from('nodes').select('id').eq('vps_instance_id', vps.id)
  const allowedNodeIds = new Set((nodes || []).map((n: any) => n.id))

  const nowIso = new Date().toISOString()
  let updated = 0
  let errors = 0
  for (const item of applied) {
    if (!item?.email || !item?.node_id) continue
    if (!allowedNodeIds.has(item.node_id)) continue // 越权丢弃
    const patch: any = { last_reconciled_at: nowIso }
    if (item.state === 'error') {
      patch.last_reconcile_error = String(item.error ?? 'unknown').slice(0, 500)
      errors++
    } else {
      patch.last_reconcile_error = null
    }
    const { error } = await admin
      .from('node_clients')
      .update(patch)
      .eq('node_id', item.node_id)
      .eq('email', item.email)
    if (!error) updated++
  }

  return NextResponse.json({ ok: true, updated, errors })
}
