import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClientRoute, buildOutboundPlan, safeOutboundSummary } from './plan.ts'

test('plan creates missing outbound and leaves observed tag unchanged', () => {
  const plan = buildOutboundPlan([
    { id: '1', tag: 'sub-us', display_name: 'US', deploy_state: 'draft' },
    { id: '2', tag: 'existing', display_name: 'Existing', deploy_state: 'active' },
  ], new Set(['existing']))
  assert.deepEqual(plan.actions.map(x => [x.kind, x.tag]), [['create', 'sub-us'], ['noop', 'existing']])
  assert.equal(plan.mutatesRuntime, true)
})

test('plan refuses duplicate desired tags', () => {
  assert.throws(() => buildOutboundPlan([
    { id: '1', tag: 'same', display_name: 'A', deploy_state: 'draft' },
    { id: '2', tag: 'same', display_name: 'B', deploy_state: 'draft' },
  ], new Set()), /重复 tag/)
})

test('builds stable per-client route with inboundTag and user', () => {
  assert.deepEqual(buildClientRoute('client-id', 'inbound-443', 'u@node', 'sub-us'), {
    type: 'field', ruleTag: 'jiedian-client-client-id', inboundTag: ['inbound-443'], user: ['u@node'], outboundTag: 'sub-us',
  })
})

test('safe summary never contains endpoint credentials', () => {
  const summary = safeOutboundSummary({ tag: 'x', protocol: 'vless', settings: { vnext: [{ address: 'a.test', port: 443, users: [{ id: 'secret-uuid' }] }] }, streamSettings: { realitySettings: { publicKey: 'secret-pbk', serverName: 'sni.test' } } } as any)
  assert.deepEqual(summary, { tag: 'x', protocol: 'vless', address: 'a.test', port: 443, network: null, security: null })
  assert.equal(JSON.stringify(summary).includes('secret'), false)
})
