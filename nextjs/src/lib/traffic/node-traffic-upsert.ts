// P2b · 每节点/每终端流量回灌 —— 纯函数,供 /api/v1/agent/sync 与测试复用。
// 设计依据:docs/current/51-node-terminal-access-traffic-sdd.md §12.2/§12.4。
//
// agent syncer 批次带 hourly_xray_traffic:[{hour_start, scope, tag, uplink_bytes, downlink_bytes}]。
//   scope='inbound' → tag=inbound_tag,归 node 级(node_traffic_stat.email='')。
//   scope='user'    → tag=email,   归终端级(node_traffic_stat.email=tag)。
// 本模块把这些行映射到 (node_id,email,bucket_hour) 主键并按主键聚合,交路由 upsert。
//
// ⚠️ upsert 用「覆盖」而非「累加」(路由侧):agent 只发已完成整点小时桶
//   (endBoundary 排除当前小时;size-cap 也按整点断开,单个小时不跨批次),故同一
//   (node,email,hour) 聚合值是稳定终值。而失败重试会用「新 batch_id」重发同批小时
//   (水位未推进),console 幂等守卫只挡同 batch_id、挡不住新 batch_id 重发——
//   累加会翻倍,覆盖则天然幂等。见 §12.2 与 reporter.go syncOnce/onSyncAck。

export interface HourlyXrayTraffic {
  hour_start: string // ISO8601,UTC 对齐小时桶
  scope: string // 'inbound' | 'user'
  tag: string // inbound_tag(inbound)| email(user)
  uplink_bytes: number
  downlink_bytes: number
}

export interface TrafficStatRow {
  node_id: string
  email: string // '' = node 级;非空 = 终端级
  bucket_hour: string // ISO8601
  uplink_bytes: number
  downlink_bytes: number
}

export interface NodeResolveCtx {
  /** inbound_tag → node_id(只含非空 tag 的节点) */
  inboundTagToNode: Map<string, string>
  /** email → node_id(来自 node_clients;仅本 VPS 名下节点) */
  emailToNode: Map<string, string>
  /** 本 VPS 名下全部 node_id;仅当恰好 1 个时用于兜底归属 */
  nodeIds: string[]
}

export interface BuildResult {
  rows: TrafficStatRow[]
  skipped: number // 无法归属到 node_id 而丢弃的行数
}

/**
 * 单条流量行 → node_id。解析不出返回 null(调用方计入 skipped)。
 * 兜底:本 VPS 恰好 1 个节点时,未匹配的 tag/email 归该唯一节点(单节点无歧义)。
 */
export function resolveNodeId(
  item: Pick<HourlyXrayTraffic, 'scope' | 'tag'>,
  ctx: NodeResolveCtx,
): string | null {
  const direct =
    item.scope === 'user'
      ? ctx.emailToNode.get(item.tag)
      : ctx.inboundTagToNode.get(item.tag)
  if (direct) return direct
  if (ctx.nodeIds.length === 1) return ctx.nodeIds[0]
  return null
}

/** 该行在 node_traffic_stat 里的 email 维度:user→tag,其余(inbound/汇总)→ ''。 */
export function emailDimension(item: Pick<HourlyXrayTraffic, 'scope' | 'tag'>): string {
  return item.scope === 'user' ? item.tag : ''
}

/**
 * 批次 hourly_xray_traffic → 去重聚合后的 node_traffic_stat 行。
 * 按 (node_id,email,bucket_hour) 聚合求和(同批不同来源计数器归同一格时相加);
 * 主键相同的多行会被合并,避免 upsert 冲突时后写覆盖前写。
 */
export function buildTrafficStatRows(
  traffic: HourlyXrayTraffic[],
  ctx: NodeResolveCtx,
): BuildResult {
  const acc = new Map<string, TrafficStatRow>()
  let skipped = 0

  for (const item of traffic) {
    if (!item || typeof item.hour_start !== 'string' || !item.hour_start) {
      skipped++
      continue
    }
    const nodeId = resolveNodeId(item, ctx)
    if (!nodeId) {
      skipped++
      continue
    }
    const email = emailDimension(item)
    const up = Number(item.uplink_bytes) || 0
    const down = Number(item.downlink_bytes) || 0
    const key = `${nodeId}|${email}|${item.hour_start}`
    const existing = acc.get(key)
    if (existing) {
      existing.uplink_bytes += up
      existing.downlink_bytes += down
    } else {
      acc.set(key, {
        node_id: nodeId,
        email,
        bucket_hour: item.hour_start,
        uplink_bytes: up,
        downlink_bytes: down,
      })
    }
  }

  return { rows: [...acc.values()], skipped }
}
