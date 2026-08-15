import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import crypto from 'crypto'

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  // 格式校验:hmac 必须是 hex 字符串,否则直接拒(防止 timingSafeEqual 因非法输入抛异常)
  if (typeof hmac !== 'string' || !/^[0-9a-fA-F]+$/.test(hmac)) return false
  const expected = crypto
    .createHmac('sha256', HEARTBEAT_SECRET)
    .update(`${instanceId}:${timestamp}`)
    .digest('hex')
  const expBuf = Buffer.from(expected, 'hex')
  const gotBuf = Buffer.from(hmac, 'hex')
  // 长度不等时 timingSafeEqual 会抛异常,先校验长度再常量时间比较
  if (expBuf.length !== gotBuf.length) return false
  return crypto.timingSafeEqual(expBuf, gotBuf)
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
  const { data: updated, error } = await adminClient
    .from('vps_instances')
    .update({
      public_ip,
      zone,
      agent_version,
      heartbeat_status: 'online',
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('gcp_instance_name', instance_id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 命中行校验:instance_id 在 vps_instances 无对应记录时,update 不报错但影响 0 行,
  // 不能返回 registered(否则任何通过 HMAC 的未知实例都"注册成功")。
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Unknown instance_id' }, { status: 404 })
  }

  return NextResponse.json({
    status: 'registered',
    sync_interval_min: 180,
    features: ['inbounds', 'outbounds', 'routing', 'stats', 'panel', 'probe'],
  })
}
