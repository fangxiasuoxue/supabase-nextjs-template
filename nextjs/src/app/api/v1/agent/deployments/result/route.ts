import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { resolveNodeStatusAfterDeploy } from '@/lib/nodes/node-lifecycle'
import crypto from 'crypto'

// POST /api/v1/agent/deployments/result
// agent poller 下发完成后回报结果:推进 node_deployments,成功则激活 node + 回填订阅。

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
  const { instance_id, timestamp, hmac, deployment_id, status, rendered_config, config_hash, error_message, subscribe_token } = body
  if (!instance_id || !timestamp || !hmac || !deployment_id || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 60) {
    return NextResponse.json({ error: 'Timestamp out of window' }, { status: 401 })
  }
  if (!verifyHmac(instance_id, timestamp, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }
  if (!['success', 'fail'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = await createServerAdminClient()

  // 取部署任务(拿 node_id)
  const { data: dep } = await admin
    .from('node_deployments')
    .select('id, node_id, status, task_type')
    .eq('id', deployment_id)
    .maybeSingle()
  if (!dep) return NextResponse.json({ error: 'Unknown deployment' }, { status: 404 })

  // 推进部署任务
  const depUpdate: any = { status: status === 'success' ? 'success' : 'fail', finished_at: new Date().toISOString() }
  if (rendered_config !== undefined) depUpdate.rendered_config = rendered_config
  if (config_hash) depUpdate.config_hash = config_hash
  if (error_message) depUpdate.error_message = String(error_message).slice(0, 2000)
  const { error: depErr } = await admin.from('node_deployments').update(depUpdate).eq('id', deployment_id)
  if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 })

  // 节点终态按 task_type 判定:create 成功→active、delete 成功→deleted、任何失败→error
  const taskType = (dep as any).task_type ?? 'create'
  const nodeStatus = resolveNodeStatusAfterDeploy(taskType, status as 'success' | 'fail')
  const nodeUpdate: any = { status: nodeStatus }
  if (status === 'success' && taskType !== 'delete') {
    nodeUpdate.last_deployed_at = new Date().toISOString()
    if (subscribe_token) nodeUpdate.subscribe_token = subscribe_token
    if (config_hash) nodeUpdate.config_hash = config_hash
  }
  const { error: nodeErr } = await admin.from('nodes').update(nodeUpdate).eq('id', dep.node_id)
  if (nodeErr) return NextResponse.json({ error: nodeErr.message }, { status: 500 })

  return NextResponse.json({ status: 'ok' })
}
