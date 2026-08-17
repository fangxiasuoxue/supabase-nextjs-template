// 原子创建 node + node_deployment(纯编排,依赖注入 store,便于单测)。
//
// 背景/Bug:deploy/route.ts 曾「先建 node,再建 deployment」但二者非事务:
// 若 deployment 插入失败,node 已建成 status=provisioning 却无对应 deployment
// → poller 无 pending 可消费,节点永远卡 provisioning(us8 即中招)。
// 修复:deployment 失败时**补偿删除**刚建的 node,绝不留孤儿。

export interface NodeStore {
  insertNode(payload: Record<string, unknown>): Promise<{ id?: string; error?: string }>
  insertDeployment(payload: Record<string, unknown>): Promise<{ id?: string; error?: string }>
  deleteNode(id: string): Promise<void>
}

export interface CreateNodeWithDeploymentInput {
  nodeInsert: Record<string, unknown>
  deploymentInsert: Record<string, unknown> // 不含 node_id;由本函数补上
}

export interface CreateResult {
  ok: boolean
  status: number
  nodeId?: string
  deploymentId?: string
  error?: string
  compensated?: boolean // 是否发生了补偿删除
}

export async function createNodeWithDeployment(
  store: NodeStore,
  input: CreateNodeWithDeploymentInput,
): Promise<CreateResult> {
  const n = await store.insertNode(input.nodeInsert)
  if (n.error || !n.id) {
    return { ok: false, status: 500, error: n.error ?? 'node insert failed' }
  }
  const d = await store.insertDeployment({ ...input.deploymentInsert, node_id: n.id })
  if (d.error || !d.id) {
    let compensated = false
    try {
      await store.deleteNode(n.id)
      compensated = true
    } catch {
      // 补偿失败也不吞掉主错误;node 会被下次巡检/对账发现
    }
    return { ok: false, status: 500, error: d.error ?? 'deployment insert failed', nodeId: n.id, compensated }
  }
  return { ok: true, status: 201, nodeId: n.id, deploymentId: d.id }
}
