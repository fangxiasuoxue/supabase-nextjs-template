import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import crypto from 'crypto'
import { gunzipSync } from 'zlib'

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? ''

function verifyHmac(instanceId: string, timestamp: number, hmac: string): boolean {
  if (typeof hmac !== 'string' || !/^[0-9a-fA-F]+$/.test(hmac)) return false
  const expected = crypto
    .createHmac('sha256', HEARTBEAT_SECRET)
    .update(`${instanceId}:${timestamp}`)
    .digest('hex')
  const expBuf = Buffer.from(expected, 'hex')
  const gotBuf = Buffer.from(hmac, 'hex')
  if (expBuf.length !== gotBuf.length) return false
  return crypto.timingSafeEqual(expBuf, gotBuf)
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
  const { agent, summary, batch_id, events, commands, config_snapshots, metrics, ip_latency } = body

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
    .from('vps_instances')
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
    .from('vps_instances')
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

  // 4b. W5:落分钟级历史指标到 vps_metrics(时序,供趋势/告警)。
  //     agent 若在 sync 批次带 metrics: [{ recorded_at, cpu_percent, mem_percent, disk_percent }]
  //     则历史落库;不带则 no-op(向后兼容)。vps_metrics 按月分区,需存在当月/DEFAULT 分区
  //     (见 migration 20260814000003)。落库失败不阻断 sync 主流程(与 events 同策略)。
  if (Array.isArray(metrics) && metrics.length > 0) {
    const metricRows = (metrics as any[]).map((m) => ({
      instance_id: vpsId,
      recorded_at: m.recorded_at ?? m.ts ?? new Date().toISOString(),
      cpu_percent: m.cpu_percent ?? m.cpu ?? null,
      mem_percent: m.mem_percent ?? m.mem ?? null,
      disk_percent: m.disk_percent ?? m.disk ?? null,
    }))
    const { error: metricsErr } = await adminClient
      .from('vps_metrics')
      .insert(metricRows as any)
    if (metricsErr) {
      console.error('vps_metrics insert error:', metricsErr.message)
    }
  }

  // 4c. 需求 #3(B 路径):US/HK 上的 agent 直接探测各 proxy-cheap IP 的时延,经 sync 上报。
  //     body.ip_latency: [{ ip, source_node, latency_ms }](source_node 如 'us1'/'hk1');
  //     按 (ip, source_node) upsert 到 ip_latency_matrix(存最新一格)。不带则 no-op。
  //     openwrt/gorelay 侧由 bench 脚本(A 路径)直接 upsert,不走此接口。
  if (Array.isArray(ip_latency) && ip_latency.length > 0) {
    const rows = (ip_latency as any[])
      .filter((r) => r?.ip && r?.source_node)
      .map((r) => ({
        ip: String(r.ip),
        source_node: String(r.source_node),
        latency_ms: r.latency_ms ?? null,
        tested_at: r.tested_at ?? new Date().toISOString(),
      }))
    if (rows.length > 0) {
      const { error: latErr } = await adminClient
        .from('ip_latency_matrix' as any)
        .upsert(rows as any, { onConflict: 'ip,source_node' })
      if (latErr) console.error('ip_latency_matrix upsert error:', latErr.message)
    }
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
      .from('agent_events')
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
