// @ts-nocheck
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

// POST /api/v1/agent/heartbeat — 降级兼容接口，仅更新心跳状态（不再写 vps_metrics）
export async function POST(request: NextRequest) {
  const body = await request.json()
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

  const adminClient = await createServerAdminClient()

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
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', vpsId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ok',
    heartbeat_interval_sec: 60,
    sync_interval_min: 180,
  })
}
