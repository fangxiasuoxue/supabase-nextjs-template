/**
 * 中转加速编排引擎 —— 把 2026-08 生产手工验证过的序列(runbook §P-B..§P-J)固化成代码。
 *
 * 三个下发面:
 *  1) 聚合点 xray:syncAggPoint() 经 callAgent(agent /xray/* API)建 socks5 入站(N 用户)
 *     + N cheap 出站 + N 带 ruleTag 路由 + persist。★ruleTag 必带,否则重启丢选路(§P-I)。
 *  2) GoRelay 隧道:syncTunnel() 经 lib/transit/gorelay 建/对账,gorelay_tunnel_id 现网权威。
 *  3) gw passwall2:generateGwUci() 产 uci 脚本 —— gw 无 jiedian-agent,应用靠外部执行(SDD 60 §编排边界)。
 *
 * 铁律:声明↔现网靠对账收敛(59 §7),不假设现网=DB;凭据不落日志。
 */
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { callAgent } from '@/lib/agent/client'
import * as gorelay from './gorelay'

// 密管解析占位:agg 用户口令引用 → 实际值。生产接密管/env;禁明文入库。
function resolveSecret(ref: string | null): string {
  if (!ref) throw new Error('missing secret ref')
  if (ref.startsWith('env:')) {
    const v = process.env[ref.slice(4)]
    if (!v) throw new Error(`env secret ${ref} not set`)
    return v
  }
  // TODO: 接密管(bw:// / vault)。当前只支持 env:。
  throw new Error(`unsupported secret ref scheme: ${ref}`)
}

type AggResult = { inbound: string; outbounds: number; routes: number; persist: string }

/**
 * 幂等重建一个聚合点的 xray(inbound 全用户 + N cheap 出站 + N ruleTag 路由 + persist)。
 * 复刻 scratchpad/agg-setup.py 的证过序列(删后建;ruleTag 必带)。
 */
export async function syncAggPoint(aggPointId: string): Promise<AggResult> {
  const db = (await createServerAdminClient()) as any // 新表未进生成 Database 类型,照 domain 模块约定 cast

  const { data: ap } = await db.from('transit_agg_point').select('*').eq('id', aggPointId).single()
  if (!ap) throw new Error(`agg_point ${aggPointId} not found`)
  const vpsId = (ap as any).vps_instance_id as string
  const port = (ap as any).listen_port as number
  const inboundTag = (ap as any).inbound_tag as string

  const { data: landings } = await db
    .from('transit_agg_landing')
    .select('*')
    .eq('agg_point_id', aggPointId)
    .eq('status', 'active')
  const rows = (landings ?? []) as any[]

  // cheap 端点+账密现网权威 = ip_assets(按 label 取,不复制入本模块表)
  const labels = rows.map((r) => r.ip_asset_label)
  const { data: assets } = await db
    .from('ip_assets')
    .select('label, public_ip, socks5_port, username, password')
    .in('label', labels)
  const assetByLabel = new Map<string, any>((assets ?? []).map((a: any) => [a.label, a]))

  const agent = (path: string, method: string, body?: unknown) =>
    callAgent(vpsId, path, { method, body: body ? JSON.stringify(body) : undefined })

  // 1) inbound:删后建,全用户
  await agent(`/xray/inbounds/${inboundTag}`, 'DELETE').catch(() => {})
  const accounts = rows.map((r) => ({ user: r.agg_user, pass: resolveSecret(r.agg_pass_ref) }))
  const inRes = await agent('/xray/inbounds', 'POST', {
    tag: inboundTag,
    listen: '0.0.0.0',
    port,
    protocol: 'socks',
    settings: { auth: 'password', udp: false, accounts },
  })

  // 2) outbounds + 3) routes(幂等:先删再建;route 必带 ruleTag)
  let ob = 0
  let rb = 0
  for (const r of rows) {
    const asset = assetByLabel.get(r.ip_asset_label)
    if (!asset) throw new Error(`ip_asset ${r.ip_asset_label} not found`)
    await agent(`/xray/outbounds/${r.outbound_tag}`, 'DELETE').catch(() => {})
    const oRes = await agent('/xray/outbounds', 'POST', {
      tag: r.outbound_tag,
      protocol: 'socks',
      settings: {
        servers: [
          {
            address: asset.public_ip,
            port: asset.socks5_port,
            users: [{ user: asset.username, pass: asset.password }],
          },
        ],
      },
    })
    if (oRes.ok) ob++

    await agent(`/xray/routing/ruleset/${r.route_tag}`, 'DELETE').catch(() => {})
    const rRes = await agent('/xray/routing/ruleset', 'POST', {
      ruleTag: r.route_tag, // ★必带才 persist(§P-I)
      type: 'field',
      inboundTag: [inboundTag],
      user: [r.agg_user],
      outboundTag: r.outbound_tag,
    })
    if (rRes.ok) rb++
  }

  // 4) persist(落盘 store 里带 ruleTag 的路由 → 重启存活)
  const pRes = await agent('/xray/persist', 'POST')

  await db.from('transit_agg_point').update({ last_deployed_at: new Date().toISOString() } as any).eq('id', aggPointId).then(() => {}, () => {})
  return {
    inbound: `${inRes.status}`,
    outbounds: ob,
    routes: rb,
    persist: `${pRes.status}`,
  }
}

/**
 * 建/对账一条 GoRelay 隧道。gorelay_tunnel_id 为空则建,建后回读 id 落库。
 * aggregated 模式:forward_spec=[聚合点:3900...] + load_balance = 1 隧道扇出 N。
 */
export async function syncTunnel(tunnelId: string): Promise<{ gorelay_tunnel_id: number }> {
  const db = (await createServerAdminClient()) as any // 新表未进生成 Database 类型,照 domain 模块约定 cast
  const { data: t } = await db.from('transit_tunnel').select('*, transit_channel(*)').eq('id', tunnelId).single()
  if (!t) throw new Error(`tunnel ${tunnelId} not found`)
  const tt = t as any
  const channel = tt.transit_channel
  if (channel.provider !== 'gorelay') {
    throw new Error(`syncTunnel only supports provider=gorelay (got ${channel.provider})`)
  }

  // 已有现网 id 且仍存在 → 幂等返回
  if (tt.gorelay_tunnel_id) {
    const existing = await gorelay.listTunnels()
    if (existing.some((x) => x.id === tt.gorelay_tunnel_id)) {
      return { gorelay_tunnel_id: tt.gorelay_tunnel_id }
    }
  }

  const forward = (tt.forward_spec as { address: string; weight?: number }[]) ?? []
  await gorelay.createTunnel({
    name: tt.name,
    in_node_group_id: channel.in_node_group_id,
    listen_port: tt.listen_port,
    forward_addresses: forward,
    load_balance_type: tt.load_balance_type,
  })
  const gid = await gorelay.findTunnelIdByName(tt.name)
  if (!gid) throw new Error(`created tunnel ${tt.name} but cannot read back id`)

  await db
    .from('transit_tunnel')
    .update({ gorelay_tunnel_id: gid, last_synced_at: new Date().toISOString() } as any)
    .eq('id', tunnelId)
  return { gorelay_tunnel_id: gid }
}

/** 对账:现网 GoRelay /tunnel vs DB transit_tunnel,报漂移(缺失/多余/未声明) */
export async function reconcileTunnels(): Promise<{ missing: string[]; orphan: number[] }> {
  const db = (await createServerAdminClient()) as any // 新表未进生成 Database 类型,照 domain 模块约定 cast
  const { data: rows } = await db.from('transit_tunnel').select('id, name, gorelay_tunnel_id').eq('status', 'active')
  const declared = (rows ?? []) as any[]
  const live = await gorelay.listTunnels()
  const liveIds = new Set(live.map((x) => x.id))
  const declaredIds = new Set(declared.map((d) => d.gorelay_tunnel_id).filter(Boolean))
  const missing = declared.filter((d) => !d.gorelay_tunnel_id || !liveIds.has(d.gorelay_tunnel_id)).map((d) => d.name)
  const orphan = live.filter((x) => !declaredIds.has(x.id)).map((x) => x.id)
  return { missing, orphan }
}

/**
 * 生成一台 gw 的 passwall2 uci 脚本(gw 无 jiedian-agent,产出供外部 ssh 执行)。
 * 复刻 scratchpad/gw-agg.sh + P-F 的 node/socks 结构。
 */
export async function generateGwUci(gw: string): Promise<string> {
  const db = (await createServerAdminClient()) as any // 新表未进生成 Database 类型,照 domain 模块约定 cast
  const { data: rows } = await db
    .from('transit_binding')
    .select('*, transit_tunnel(listen_port)')
    .eq('gw', gw)
    .eq('status', 'active')
  const bindings = (rows ?? []) as any[]

  const lines: string[] = [
    'set -eu',
    'TS=$(date +%Y%m%d-%H%M%S); cp /etc/config/passwall2 /root/passwall2.bak-$TS',
    'CH=$(uci changes passwall2 2>/dev/null||true); [ -n "$CH" ] && { echo "!!未提交变更,中止"; exit 9; }',
  ]
  // reality 落地节点需 uuid/pbk/sid —— 从 nodes/node_deployments 取(此处按 landing_ref=node id 预留;
  // 生产实现应在此 resolve reality 参数,同 §P-F)。cheap 用账密/agg 用户名。
  for (const b of bindings) {
    const n = b.node_name
    const localPort = (b as any).transit_tunnel?.listen_port
    const p = b.consume_port
    if (b.landing_kind === 'cheap-agg') {
      const pass = 'RESOLVE_AGG_PASS' // 生产:从 transit_agg_landing.agg_pass_ref 密管解析
      lines.push(
        `uci set passwall2.${n}=nodes; uci set passwall2.${n}.type=Xray; uci set passwall2.${n}.protocol=socks; ` +
          `uci set passwall2.${n}.address=127.0.0.1; uci set passwall2.${n}.port=${localPort}; ` +
          `uci set passwall2.${n}.username="${b.agg_user}"; uci set passwall2.${n}.password="${pass}"; ` +
          `uci set passwall2.${n}.group=GRagg; uci set passwall2.${n}.remarks="${n}"`
      )
    } else if (b.landing_kind === 'cheap-direct') {
      lines.push(`# ${n}: cheap-direct socks (账密从 ip_assets ${b.landing_ref} 解析) → 127.0.0.1:${localPort}`)
    } else {
      lines.push(`# ${n}: reality (uuid/pbk/sid 从 node ${b.landing_ref} 的 node_deployments 解析) → 127.0.0.1:${localPort}`)
    }
    lines.push(
      `uci set passwall2.pcs_${p}=socks; uci set passwall2.pcs_${p}.enabled=1; ` +
        `uci set passwall2.pcs_${p}.port=${p}; uci set passwall2.pcs_${p}.node=${n}; uci set passwall2.pcs_${p}.bind_local=0`
    )
  }
  lines.push('uci commit passwall2; /etc/init.d/passwall2 reload; echo "reload done"')
  return lines.join('\n')
}
