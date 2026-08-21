// P1 · 终端(seat)期望态构造 —— 纯函数,供 /api/v1/agent/clients/desired 与测试复用。
// 设计依据:docs/current/51-node-terminal-access-traffic-sdd.md §11。
// "在册(enrolled)"判定 = enabled 且未到期;agent 据此 reconcile(缺则 AddUser、离册则 RemoveUser)。

export interface NodeClientRow {
  node_id: string
  email: string
  cred_ref: string // P1:直接存 vless uuid(DB 运行态,非 git);broker/jms:// 留后续
  protocol: string
  enabled: boolean
  expires_at: string | null // ISO8601 或 null(不过期)
  ip_limit: number | null
  // 下面 P2 字段,P1 可能为 undefined/null
  quota_bytes?: number | null
  quota_period?: string | null
  period_started_at?: string | null
  over_action?: string | null
}

export interface DesiredClient {
  node_id: string
  inbound_tag: string | null
  email: string
  cred: string
  protocol: string
  enabled: boolean
  expires_at: string | null
  ip_limit: number | null
  enrolled: boolean // = 便利位:enabled && 未到期(agent 亦可自算)
  quota_bytes?: number | null
  quota_period?: string | null
  period_started_at?: string | null
  over_action?: string | null
}

export interface DesiredResponse {
  clients: DesiredClient[]
}

/** 在册判定:enabled 且(不过期 或 now < expires_at)。nowSec = Unix 秒。 */
export function isClientEnrolled(
  row: Pick<NodeClientRow, 'enabled' | 'expires_at'>,
  nowSec: number,
): boolean {
  if (!row.enabled) return false
  if (row.expires_at == null) return true
  const exp = Date.parse(row.expires_at)
  if (Number.isNaN(exp)) return false // 无法解析的到期时间 → 保守判为离册
  return nowSec < Math.floor(exp / 1000)
}

/** DB 行 → 下发 wire 对象。inboundTagByNode:node_id → inbound_tag。
 *  gatedNodeIds:节点级总门命中的 node(到期/总配额超限)→ 该节点全部终端强制离册(enrolled=false)。 */
export function toDesiredClient(
  row: NodeClientRow,
  inboundTagByNode: Map<string, string | null>,
  nowSec: number,
  gatedNodeIds?: Set<string>,
): DesiredClient {
  const nodeGated = gatedNodeIds?.has(row.node_id) ?? false
  return {
    node_id: row.node_id,
    inbound_tag: inboundTagByNode.get(row.node_id) ?? null,
    email: row.email,
    cred: row.cred_ref,
    protocol: row.protocol,
    enabled: row.enabled,
    expires_at: row.expires_at,
    ip_limit: row.ip_limit,
    enrolled: isClientEnrolled(row, nowSec) && !nodeGated,
    quota_bytes: row.quota_bytes ?? null,
    quota_period: row.quota_period ?? null,
    period_started_at: row.period_started_at ?? null,
    over_action: row.over_action ?? null,
  }
}

/** 组装完整下发响应(全集;agent 自行 reconcile)。gatedNodeIds 见 toDesiredClient。 */
export function buildDesiredResponse(
  rows: NodeClientRow[],
  inboundTagByNode: Map<string, string | null>,
  nowSec: number,
  gatedNodeIds?: Set<string>,
): DesiredResponse {
  return { clients: rows.map((r) => toDesiredClient(r, inboundTagByNode, nowSec, gatedNodeIds)) }
}
