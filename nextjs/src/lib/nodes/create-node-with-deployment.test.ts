import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNodeWithDeployment, type NodeStore } from './create-node-with-deployment.ts'

// 可编程假 store,记录调用序列
function fakeStore(opts: {
  node?: { id?: string; error?: string }
  deployment?: { id?: string; error?: string }
  deleteThrows?: boolean
}): NodeStore & { calls: string[]; deleted: string[] } {
  const calls: string[] = []
  const deleted: string[] = []
  return {
    calls,
    deleted,
    async insertNode(p) {
      calls.push('insertNode')
      return opts.node ?? { id: 'node-1' }
    },
    async insertDeployment(p) {
      calls.push('insertDeployment')
      assert.equal((p as any).node_id, 'node-1', 'deployment 必须带上刚建的 node_id')
      return opts.deployment ?? { id: 'dep-1' }
    },
    async deleteNode(id) {
      calls.push('deleteNode')
      deleted.push(id)
      if (opts.deleteThrows) throw new Error('delete failed')
    },
  }
}

const input = { nodeInsert: { name: 'US8-reality' }, deploymentInsert: { task_type: 'create', status: 'pending' } }

test('happy path:两行都建成 → ok/201,不删除', async () => {
  const s = fakeStore({})
  const r = await createNodeWithDeployment(s, input)
  assert.equal(r.ok, true)
  assert.equal(r.status, 201)
  assert.equal(r.nodeId, 'node-1')
  assert.equal(r.deploymentId, 'dep-1')
  assert.deepEqual(s.calls, ['insertNode', 'insertDeployment'])
  assert.equal(s.deleted.length, 0)
})

test('deployment 失败 → 补偿删除 node,绝不留孤儿(修卡provisioning根因)', async () => {
  const s = fakeStore({ deployment: { error: 'insert deployment boom' } })
  const r = await createNodeWithDeployment(s, input)
  assert.equal(r.ok, false)
  assert.equal(r.status, 500)
  assert.equal(r.compensated, true)
  assert.deepEqual(s.deleted, ['node-1'], 'node-1 必须被补偿删除')
  assert.deepEqual(s.calls, ['insertNode', 'insertDeployment', 'deleteNode'])
})

test('node 失败 → 不尝试建 deployment', async () => {
  const s = fakeStore({ node: { error: 'node boom' } })
  const r = await createNodeWithDeployment(s, input)
  assert.equal(r.ok, false)
  assert.equal(r.status, 500)
  assert.ok(!s.calls.includes('insertDeployment'))
})

test('补偿删除本身失败也不吞主错误,标 compensated=false', async () => {
  const s = fakeStore({ deployment: { error: 'boom' }, deleteThrows: true })
  const r = await createNodeWithDeployment(s, input)
  assert.equal(r.ok, false)
  assert.equal(r.compensated, false)
  assert.match(r.error ?? '', /boom/)
})
