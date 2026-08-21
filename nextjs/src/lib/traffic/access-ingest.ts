// P3 · 访问日志入库 —— 把 agent 上报的 access_stats 桶映射到 node_id 并去重,供 sync 路由 upsert。
// 设计依据:docs/current/51 §4.4。与 node-traffic-upsert 同款 email→node_id 映射 + 单节点兜底。

export interface AccessStatBucket {
  bucket_hour: string // ISO8601
  email: string // '' = 匿名 client
  domain: string
  outbound_tag: string
  hits: number
  uniq_clients: number
}

export interface AccessStatRow {
  node_id: string
  email: string
  domain: string
  outbound_tag: string
  bucket_hour: string
  hits: number
  uniq_clients: number
}

export interface AccessResolveCtx {
  emailToNode: Map<string, string> // email → node_id(来自 node_clients)
  nodeIds: string[] // 本 VPS 名下全部 node_id;恰 1 个时兜底归属
}

export interface AccessBuildResult {
  rows: AccessStatRow[]
  skipped: number
}

function num(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

/**
 * 解析 node_id:email 非空 → node_clients 反查;查不到或匿名(email='')→ 单节点 VPS 兜底唯一节点;
 * 多节点且无法归属 → null(丢弃)。
 */
export function resolveAccessNodeId(email: string, ctx: AccessResolveCtx): string | null {
  if (email) {
    const direct = ctx.emailToNode.get(email)
    if (direct) return direct
  }
  if (ctx.nodeIds.length === 1) return ctx.nodeIds[0]
  return null
}

/**
 * access_stats 桶 → 去重聚合后的 node_access_stat 行。
 * 按 (node_id,email,domain,outbound_tag,bucket_hour) 聚合(同批归同格 → hits/uniq 相加)。
 * 注:console 侧 upsert 用覆盖(每完成小时报一次、值稳定);此处的批内聚合是把同批多来源合并成一格。
 */
export function buildAccessStatRows(buckets: AccessStatBucket[], ctx: AccessResolveCtx): AccessBuildResult {
  const acc = new Map<string, AccessStatRow>()
  let skipped = 0
  for (const b of buckets) {
    if (!b || typeof b.bucket_hour !== 'string' || !b.bucket_hour) {
      skipped++
      continue
    }
    const email = typeof b.email === 'string' ? b.email : ''
    const nodeId = resolveAccessNodeId(email, ctx)
    if (!nodeId) {
      skipped++
      continue
    }
    const domain = typeof b.domain === 'string' ? b.domain : ''
    const outbound = typeof b.outbound_tag === 'string' ? b.outbound_tag : ''
    const key = `${nodeId}|${email}|${domain}|${outbound}|${b.bucket_hour}`
    const cur = acc.get(key)
    if (cur) {
      cur.hits += num(b.hits)
      cur.uniq_clients += num(b.uniq_clients)
    } else {
      acc.set(key, {
        node_id: nodeId,
        email,
        domain,
        outbound_tag: outbound,
        bucket_hour: b.bucket_hour,
        hits: num(b.hits),
        uniq_clients: num(b.uniq_clients),
      })
    }
  }
  return { rows: [...acc.values()], skipped }
}
