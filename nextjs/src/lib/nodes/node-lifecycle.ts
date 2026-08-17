// 节点生命周期纯逻辑(删除/修改/部署后状态判定),便于单测。
// 配套:DELETE/PATCH /api/v1/admin/nodes/[id];result 路由按 task_type 判节点终态。
// nodes.status 允许值(2026-08-17 实测 CHECK):active/provisioning/error/suspended/deleted
// (deleting/disabled/inactive 均被拒)。

export type AgentDeployStatus = 'success' | 'fail'

// pending 端点应下发给 poller 的任务类型。曾只 'create',致 delete 任务永不被消费
// (agent 有 processDelete 也拉不到)。加 'delete'。新增可下发类型时改这里。
export const PENDING_DISPATCH_TASK_TYPES = ['create', 'delete'] as const

// v1 可安全直改的节点元数据。改 inbound 参数(port/tag/reality)需重新下发、会轮换密钥,
// 不在 v1 直改范围 → 由 sanitize 拒绝,提示走重新部署。
export const NODE_UPDATE_ALLOWED = ['name'] as const

export function sanitizeNodeUpdate(
  patch: Record<string, unknown>,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const allowed = NODE_UPDATE_ALLOWED as readonly string[]
  const forbidden = Object.keys(patch ?? {}).filter((k) => !allowed.includes(k))
  if (forbidden.length) {
    return {
      ok: false,
      error: `不允许直接修改字段: ${forbidden.join(', ')}(改 inbound 参数需重新部署、会轮换密钥,v1 不支持)`,
    }
  }
  const out: Record<string, unknown> = {}
  for (const k of allowed) {
    const v = (patch ?? {})[k]
    if (v !== undefined && String(v).trim()) out[k] = String(v).trim()
  }
  if (Object.keys(out).length === 0) return { ok: false, error: '无可更新字段' }
  return { ok: true, patch: out }
}

// node_deployments.deploy_mode 的 DB CHECK 约束允许值(实测 node_deployments_deploy_mode_check)。
// 目前只实现 agent_api(B poller)。表单曾误发 'auto'/'manual' → 违反约束报 23514。
export const DEPLOY_MODES = ['agent_api'] as const
export const DEPLOY_MODE_DEFAULT: (typeof DEPLOY_MODES)[number] = 'agent_api'

// 规范化 deploy_mode:非法/缺省一律回落 agent_api,杜绝 DB check 违规。
export function normalizeDeployMode(v?: string | null): string {
  return v && (DEPLOY_MODES as readonly string[]).includes(v) ? v : DEPLOY_MODE_DEFAULT
}

export interface ExistingNodeLite {
  name?: string | null
  inbound_tag?: string | null
  port?: number | null
  status?: string | null
}

// 检测候选落地与同 VPS 现有节点的冲突:相同 inbound_tag(部署会 RemoveInbound 顶掉旧的)
// 或相同端口(xray 同端口冲突)→ 会让第一个失效。deleted 节点已拆除,不算冲突。
// 返回冲突原因 + 冲突对象名,或 null。
export function findNodeConflict(
  existing: ExistingNodeLite[],
  candidate: { inbound_tag?: string | null; port?: number | null },
): { reason: 'tag' | 'port'; conflictWith: string } | null {
  for (const n of existing || []) {
    if (!n || n.status === 'deleted') continue
    if (candidate.inbound_tag && n.inbound_tag && n.inbound_tag === candidate.inbound_tag) {
      return { reason: 'tag', conflictWith: n.name || n.inbound_tag }
    }
    if (candidate.port && n.port && Number(n.port) === Number(candidate.port)) {
      return { reason: 'port', conflictWith: n.name || String(n.port) }
    }
  }
  return null
}

// 删除 = 建一条 task_type=delete 的部署任务,交 agent poller 去机器上拆 inbound。
export function buildDeleteDeployment(nodeId: string): Record<string, unknown> {
  return { node_id: nodeId, task_type: 'delete', deploy_mode: DEPLOY_MODE_DEFAULT, status: 'pending' }
}

// 部署回报后,节点应置什么终态(供 result 路由用)。
export function resolveNodeStatusAfterDeploy(
  taskType: string,
  agentStatus: AgentDeployStatus,
): 'active' | 'deleted' | 'error' {
  if (agentStatus === 'fail') return 'error'
  if (taskType === 'delete') return 'deleted'
  return 'active'
}
