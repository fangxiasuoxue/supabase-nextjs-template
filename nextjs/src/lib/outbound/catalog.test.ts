import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNonSecretJson, assessEndpointBulkDelete, validOutboundTag, validSecretRef } from './catalog.ts'

test('outbound tag accepts Xray-safe values only', () => {
  assert.equal(validOutboundTag('sz1-cheap-us09'), true)
  assert.equal(validOutboundTag('bad tag'), false)
  assert.equal(validOutboundTag('../bad'), false)
})

test('secret reference accepts approved brokers, never a raw subscription URL', () => {
  assert.equal(validSecretRef('bw://outbound/subscription/vendor-a'), true)
  assert.equal(validSecretRef('env://VENDOR_A_SUB_URL'), true)
  assert.equal(validSecretRef('https://vendor.example/token'), false)
})

test('non-secret config rejects credential keys and share URLs recursively', () => {
  assert.doesNotThrow(() => assertNonSecretJson({ region: 'us', port: 4201, origin: 'runtime_import' }))
  assert.throws(() => assertNonSecretJson({ auth: { password: 'x' } }), /secret_ref/)
  assert.throws(() => assertNonSecretJson({ endpoint: 'vless://credential@example' }), /secret_ref/)
  assert.throws(() => assertNonSecretJson({ subscription_url: 'anything' }), /secret_ref/)
})

test('bulk endpoint delete allows only unbound non-active outbound references', () => {
  assert.deepEqual(assessEndpointBulkDelete([
    { id: 'draft', tag: 'd', deploy_state: 'draft' },
    { id: 'error', tag: 'e', deploy_state: 'error' },
  ], new Set()), { deletableOutboundIds: ['draft', 'error'], blockers: [] })
  assert.deepEqual(assessEndpointBulkDelete([
    { id: 'active', tag: 'a', deploy_state: 'active' },
    { id: 'bound', tag: 'b', deploy_state: 'draft' },
  ], new Set(['bound'])), { deletableOutboundIds: [], blockers: ['a(active)', 'b(client-bound)'] })
})
