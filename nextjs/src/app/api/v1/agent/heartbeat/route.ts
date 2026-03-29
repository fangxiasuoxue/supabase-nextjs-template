import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import crypto from 'crypto'

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  const expected = crypto
    .createHmac('sha256', HEARTBEAT_SECRET)
    .update(`${instanceId}:${timestamp}`)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
}

// POST /api/v1/agent/heartbeat — 接收心跳，更新 vps_instances + 写 vps_metrics
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    instance_id,
    timestamp,
    hmac,
    cpu_percent,
    memory_percent,
    disk_used_gb,
    rx_bytes,
    tx_bytes,
    service_states,
  } = body

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

  const adminClient = await createServerAdminClient()
  const collectedAt = new Date().toISOString()

  // 查 vps_instances.id（用 gcp_instance_name 作查询键）
  const { data: vps, error: vpsErr } = await adminClient
    .from('vps_instances' as any)
    .select('id')
    .eq('gcp_instance_name', instance_id)
    .single()

  if (vpsErr || !vps) {
    return NextResponse.json({ error: 'VPS not found' }, { status: 404 })
  }

  const vpsId = (vps as any).id

  // 更新 vps_instances 心跳状态
  const { error: updateErr } = await adminClient
    .from('vps_instances' as any)
    .update({
      heartbeat_status: 'online',
      last_heartbeat_at: collectedAt,
    })
    .eq('id', vpsId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 写入 vps_metrics（月分区表）
  const { error: metricsErr } = await adminClient
    .from('vps_metrics' as any)
    .insert({
      instance_id: vpsId,
      cpu_percent: cpu_percent ?? null,
      memory_percent: memory_percent ?? null,
      disk_used_gb: disk_used_gb ?? null,
      rx_bytes: rx_bytes ?? null,
      tx_bytes: tx_bytes ?? null,
      service_states: service_states ?? null,
      collected_at: collectedAt,
    })

  if (metricsErr) {
    // 指标写入失败不阻断心跳响应，仅记录日志
    console.error('vps_metrics insert error:', metricsErr.message)
  }

  return NextResponse.json({ status: 'ok' })
}
