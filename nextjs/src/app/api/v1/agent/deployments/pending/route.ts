import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { PENDING_DISPATCH_TASK_TYPES } from '@/lib/nodes/node-lifecycle'
import crypto from 'crypto'

// POST /api/v1/agent/deployments/pending
// agent poller 拉取"属于本 instance 的 pending 部署任务"(B 阶段)。HMAC 鉴权同 register/sync。
// 返回渲染下发所需:deployment + node(参数) + node_profile(config_template)。

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

  // instance_id -> vps_instances(与 register 一致:gcp_instance_name 匹配;兼容 name)
  const { data: vps } = await admin
    .from('vps_instances')
    .select('id')
    .or(`gcp_instance_name.eq.${instance_id},name.eq.${instance_id}`)
    .limit(1)
    .maybeSingle()
  if (!vps) {
    return NextResponse.json({ error: 'Unknown instance_id' }, { status: 404 })
  }

  // 该 VPS 的节点里,取 pending 的 create 部署任务
  const { data: nodes } = await admin
    .from('nodes')
    .select('id, name, port, inbound_tag, public_ip, protocol, profile_id')
    .eq('vps_instance_id', vps.id)
  const nodeIds = (nodes || []).map((n: any) => n.id)
  if (nodeIds.length === 0) return NextResponse.json({ deployments: [] })

  const { data: deps } = await admin
    .from('node_deployments')
    .select('id, node_id, task_type, status, request_payload')
    .in('node_id', nodeIds)
    .eq('status', 'pending')
    .in('task_type', PENDING_DISPATCH_TASK_TYPES as unknown as string[])
    .order('created_at', { ascending: true })
  if (!deps || deps.length === 0) return NextResponse.json({ deployments: [] })

  // 关联 profile.config_template
  const profileIds = Array.from(new Set((nodes || []).map((n: any) => n.profile_id).filter(Boolean)))
  const { data: profiles } = profileIds.length
    ? await admin.from('node_profiles').select('id, engine, transport_protocol, config_template').in('id', profileIds)
    : { data: [] as any[] }
  const nodeById = new Map((nodes || []).map((n: any) => [n.id, n]))
  const profById = new Map((profiles || []).map((p: any) => [p.id, p]))

  const deployments = deps.map((d: any) => {
    const n = nodeById.get(d.node_id) || {}
    const p = profById.get(n.profile_id) || {}
    return {
      deployment_id: d.id,
      task_type: d.task_type,
      node: { id: n.id, name: n.name, port: n.port, inbound_tag: n.inbound_tag, public_ip: n.public_ip, protocol: n.protocol },
      profile: { engine: p.engine, transport_protocol: p.transport_protocol, config_template: p.config_template || {} },
      request_payload: d.request_payload || {},
    }
  })
  return NextResponse.json({ deployments })
}
