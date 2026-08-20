// P2e · 流量榜聚合纯函数 —— 把 node_traffic_stat 小时桶行聚合成"节点总量 + 每终端总量"。
// 设计依据:docs/current/51 §12.6。供 /api/v1/admin/nodes/[id]/traffic 与测试复用。

export interface TrafficStatRow {
  email: string // '' = node 级(inbound 汇总);非空 = 终端级
  uplink_bytes: number
  downlink_bytes: number
}

export interface TerminalTraffic {
  email: string
  uplink_bytes: number
  downlink_bytes: number
  total_bytes: number
}

export interface TrafficRollup {
  node_uplink_bytes: number // 节点级(email='')上行合计
  node_downlink_bytes: number
  node_total_bytes: number
  terminals: TerminalTraffic[] // 各终端(email<>'')按 total 降序
}

function num(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/**
 * 聚合窗口内多小时桶行 → 节点总量 + 每终端总量(降序)。
 * email='' 行汇入 node 级;email<>'' 行按 email 累加为终端级。
 * 注意:node 级是 inbound 汇总,通常 ≈ 各终端之和 + 匿名落地 client 流量,二者独立展示,不做勾稽。
 */
export function rollupTraffic(rows: TrafficStatRow[]): TrafficRollup {
  let nodeUp = 0
  let nodeDown = 0
  const byEmail = new Map<string, TerminalTraffic>()

  for (const r of rows) {
    const up = num(r.uplink_bytes)
    const down = num(r.downlink_bytes)
    if (!r.email) {
      nodeUp += up
      nodeDown += down
      continue
    }
    const cur = byEmail.get(r.email)
    if (cur) {
      cur.uplink_bytes += up
      cur.downlink_bytes += down
      cur.total_bytes += up + down
    } else {
      byEmail.set(r.email, { email: r.email, uplink_bytes: up, downlink_bytes: down, total_bytes: up + down })
    }
  }

  const terminals = [...byEmail.values()].sort(
    (a, b) => b.total_bytes - a.total_bytes || a.email.localeCompare(b.email),
  )
  return {
    node_uplink_bytes: nodeUp,
    node_downlink_bytes: nodeDown,
    node_total_bytes: nodeUp + nodeDown,
    terminals,
  }
}
