import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeNodeUpdate,
  buildDeleteDeployment,
  resolveNodeStatusAfterDeploy,
  PENDING_DISPATCH_TASK_TYPES,
  normalizeDeployMode,
  DEPLOY_MODES,
  findNodeConflict,
} from './node-lifecycle.ts'

test('findNodeConflict: 同 tag → 冲突(会顶掉第一个)', () => {
  const ex = [{ name: 'US8-reality', inbound_tag: 'jd-land-us8', port: 443, status: 'active' }]
  const c = findNodeConflict(ex, { inbound_tag: 'jd-land-us8', port: 4001 })
  assert.equal(c?.reason, 'tag')
  assert.equal(c?.conflictWith, 'US8-reality')
})

test('findNodeConflict: 同端口 → 冲突(xray 端口占用)', () => {
  const ex = [{ name: 'US8-reality', inbound_tag: 'jd-land-us8', port: 443, status: 'active' }]
  const c = findNodeConflict(ex, { inbound_tag: 'jd-other', port: 443 })
  assert.equal(c?.reason, 'port')
})

test('findNodeConflict: deleted 节点已拆除,不算冲突', () => {
  const ex = [{ name: 'old', inbound_tag: 'jd-land-us8', port: 443, status: 'deleted' }]
  assert.equal(findNodeConflict(ex, { inbound_tag: 'jd-land-us8', port: 443 }), null)
})

test('findNodeConflict: tag 与端口都不同 → 无冲突(合法的第二落地)', () => {
  const ex = [{ name: 'US8-reality', inbound_tag: 'jd-land-us8', port: 443, status: 'active' }]
  assert.equal(findNodeConflict(ex, { inbound_tag: 'jd-extra-us8', port: 4001 }), null)
})

test('findNodeConflict: 空现有 → null', () => {
  assert.equal(findNodeConflict([], { inbound_tag: 'x', port: 443 }), null)
})

// DB CHECK node_deployments_deploy_mode_check 只认 agent_api(实测);表单曾发 'auto'/'manual' 违规(23514)。
test('normalizeDeployMode: 非法值(auto/manual)回落 agent_api,杜绝 DB check 违规', () => {
  assert.equal(normalizeDeployMode('auto'), 'agent_api')
  assert.equal(normalizeDeployMode('manual'), 'agent_api')
  assert.equal(normalizeDeployMode(undefined), 'agent_api')
  assert.equal(normalizeDeployMode(null), 'agent_api')
  assert.equal(normalizeDeployMode('agent_api'), 'agent_api')
})

test('DEPLOY_MODES 与 buildDeleteDeployment 的 deploy_mode 都是 DB 允许值', () => {
  assert.ok(DEPLOY_MODES.includes('agent_api'))
  assert.ok((DEPLOY_MODES as readonly string[]).includes(buildDeleteDeployment('n').deploy_mode as string))
})

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
