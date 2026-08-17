import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeNodeUpdate,
  buildDeleteDeployment,
  resolveNodeStatusAfterDeploy,
  PENDING_DISPATCH_TASK_TYPES,
} from './node-lifecycle.ts'

test('PENDING_DISPATCH_TASK_TYPES 必须含 create 和 delete(否则 delete 永不被消费)', () => {
  assert.ok(PENDING_DISPATCH_TASK_TYPES.includes('create'))
  assert.ok(PENDING_DISPATCH_TASK_TYPES.includes('delete'))
})

test('sanitizeNodeUpdate: 允许改 name', () => {
  const r = sanitizeNodeUpdate({ name: '  US8-新名  ' })
  assert.equal(r.ok, true)
  assert.deepEqual((r as any).patch, { name: 'US8-新名' })
})

test('sanitizeNodeUpdate: 拒绝改 inbound 参数(提示需重部署)', () => {
  const r = sanitizeNodeUpdate({ port: 8443 })
  assert.equal(r.ok, false)
  assert.match((r as any).error, /重新部署|轮换密钥/)
})

test('sanitizeNodeUpdate: 拒绝改 inbound_tag / public_ip', () => {
  assert.equal(sanitizeNodeUpdate({ inbound_tag: 'x' }).ok, false)
  assert.equal(sanitizeNodeUpdate({ public_ip: 'y' }).ok, false)
})

test('sanitizeNodeUpdate: 空/无有效字段 → 报错', () => {
  assert.equal(sanitizeNodeUpdate({}).ok, false)
  assert.equal(sanitizeNodeUpdate({ name: '   ' }).ok, false)
})

test('buildDeleteDeployment: 结构正确', () => {
  assert.deepEqual(buildDeleteDeployment('n1'), {
    node_id: 'n1',
    task_type: 'delete',
    deploy_mode: 'agent_api',
    status: 'pending',
  })
})

test('resolveNodeStatusAfterDeploy: delete 成功 → deleted', () => {
  assert.equal(resolveNodeStatusAfterDeploy('delete', 'success'), 'deleted')
})

test('resolveNodeStatusAfterDeploy: create 成功 → active', () => {
  assert.equal(resolveNodeStatusAfterDeploy('create', 'success'), 'active')
})

test('resolveNodeStatusAfterDeploy: 任何失败 → error', () => {
  assert.equal(resolveNodeStatusAfterDeploy('delete', 'fail'), 'error')
  assert.equal(resolveNodeStatusAfterDeploy('create', 'fail'), 'error')
})
