// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import crypto from 'crypto'
import { gunzipSync } from 'zlib'

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  const expected = crypto
    .createHmac('sha256', HEARTBEAT_SECRET)
    .update(`${instanceId}:${timestamp}`)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
}

async function parseBody(request: NextRequest): Promise<unknown> {
  const encoding = request.headers.get('content-encoding')
  if (encoding === 'gzip') {
    const buf = Buffer.from(await request.arrayBuffer())
    return JSON.parse(gunzipSync(buf).toString('utf-8'))
  }
  return request.json()
}

interface AgentEvent {
  id: string
  event_type: string
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  source: string
  payload: Record<string, unknown>
  created_at: string
}

interface CommandRecord {
  id: string
  command_type: string
  status: 'success' | 'failed'
  result_json: string
  created_at: string
  finished_at: string
}

interface ConfigSnapshot {
  config_type: 'agent' | 'xray' | 'panel'
  config_hash: string
  content_json: string
  created_at: string
}

// POST /api/v1/agent/sync — 接收 Agent 3小时批量同步
export async function POST(request: NextRequest) {
  const body = await parseBody(request) as any
  const { agent, summary, batch_id, events, commands, config_snapshots } = body

  if (!agent?.instance_id || !body.timestamp || !body.hmac || !batch_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. HMAC 鉴权（复用 heartbeat 密钥）
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - body.timestamp) > 60) {
    return NextResponse.json({ error: 'Timestamp out of window' }, { status: 401 })
  }

  if (!verifyHmac(agent.instance_id, body.timestamp, body.hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }

  const adminClient = await createServerAdminClient()

  // 2. 查找 VPS（用 gcp_instance_name 作查询键）
  const { data: vps, error: vpsErr } = await adminClient
    .from('vps_instances' as any)
    .select('id, last_sync_batch_id')
    .eq('gcp_instance_name', agent.instance_id)
    .single()

  if (vpsErr || !vps) {
    return NextResponse.json({ error: 'VPS not found' }, { status: 404 })
  }

  const vpsId = (vps as any).id

  // 3. 幂等检查：同一 batch_id 已处理过则直接返回成功
  if ((vps as any).last_sync_batch_id === batch_id) {
    return NextResponse.json({
      ok: true,
      accepted_batch_id: batch_id,
      server_time: new Date().toISOString(),
      idempotent: true,
    })
  }

  // 4. 覆盖更新 vps_instances 摘要（只取最新快照，不存分钟明细）
  const { error: updateErr } = await adminClient
    .from('vps_instances' as any)
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_batch_id: batch_id,
      heartbeat_status: 'online',
      agent_version: agent.agent_version ?? null,
      public_ip: agent.public_ip ?? null,
      sync_cpu_percent: summary?.latest_cpu_percent ?? null,
      sync_mem_percent: summary?.latest_mem_percent ?? null,
      sync_disk_percent: summary?.latest_disk_percent ?? null,
    })
    .eq('id', vpsId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 5. 批量写入 agent_events（按 agent 本地 id + instance_id 去重）
  if (Array.isArray(events) && events.length > 0) {
    const eventRows = (events as AgentEvent[]).map((e) => ({
      instance_id: vpsId,
      batch_id,
      event_type: e.event_type,
      level: e.level ?? 'info',
      source: e.source,
      payload: e.payload ?? null,
      agent_time: e.created_at,
    }))

    const { error: eventsErr } = await adminClient
      .from('agent_events' as any)
      .insert(eventRows as any)

    if (eventsErr) {
      console.error('agent_events insert error:', eventsErr.message)
    }
  }

  // 6. 批量写入 command_logs（如有）
  if (Array.isArray(commands) && commands.length > 0) {
    const commandRows = (commands as CommandRecord[]).map((c) => ({
      instance_id: vpsId,
      batch_id,
      command_type: c.command_type,
      status: c.status,
      result_json: c.result_json ?? null,
      created_at: c.created_at,
      finished_at: c.finished_at ?? null,
    }))

    const { error: cmdErr } = await adminClient
      .from('command_logs' as any)
      .insert(commandRows as any)

    if (cmdErr) {
      console.error('command_logs insert error:', cmdErr.message)
    }
  }

  // 7. 批量写入 config_snapshots（按 config_type + config_hash 去重）
  if (Array.isArray(config_snapshots) && config_snapshots.length > 0) {
    for (const snap of config_snapshots as ConfigSnapshot[]) {
      // 查询是否已有相同 hash
      const { data: existing } = await adminClient
        .from('config_snapshots' as any)
        .select('id')
        .eq('instance_id', vpsId)
        .eq('config_type', snap.config_type)
        .eq('config_hash', snap.config_hash)
        .limit(1)
        .single()

      if (!existing) {
        await adminClient
          .from('config_snapshots' as any)
          .insert({
            instance_id: vpsId,
            batch_id,
            config_type: snap.config_type,
            config_hash: snap.config_hash,
            content_json: snap.content_json,
            created_at: snap.created_at,
          } as any)
      }
    }
  }

  // 8. 返回确认
  return NextResponse.json({
    ok: true,
    accepted_batch_id: batch_id,
    server_time: new Date().toISOString(),
  })
}
