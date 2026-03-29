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

// POST /api/v1/agent/register — agent 首次注册
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { instance_id, public_ip, zone, agent_version, hostname, timestamp, hmac } = body

  if (!instance_id || !timestamp || !hmac) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 时间窗校验：±60s
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 60) {
    return NextResponse.json({ error: 'Timestamp out of window' }, { status: 401 })
  }

  // HMAC 验证
  if (!verifyHmac(instance_id, timestamp, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }

  const adminClient = await createServerAdminClient()

  // 按 gcp_instance_name 找到对应记录并更新
  const { error } = await adminClient
    .from('vps_instances' as any)
    .update({
      public_ip,
      zone,
      agent_version,
      heartbeat_status: 'online',
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('gcp_instance_name', instance_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    status: 'registered',
    heartbeat_interval_sec: 60,
    features: ['inbounds', 'outbounds', 'routing', 'stats', 'panel', 'probe'],
  })
}
