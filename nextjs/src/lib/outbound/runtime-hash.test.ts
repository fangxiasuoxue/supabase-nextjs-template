import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runtimeHash } from './runtime-hash.ts'

test('runtime hash is stable across recursively reordered object keys', () => {
  const desired = { tag: 'sub-vless', protocol: 'vless', settings: { vnext: [{ address: 'a', port: 443, users: [{ id: 'u', encryption: 'none' }] }] } }
  const observed = { protocol: 'vless', settings: { vnext: [{ users: [{ encryption: 'none', id: 'u' }], port: 443, address: 'a' }] }, tag: 'sub-vless' }
  assert.equal(runtimeHash(desired), runtimeHash(observed))
})

test('runtime hash retains array order and value differences', () => {
  assert.notEqual(runtimeHash({ x: [1, 2] }), runtimeHash({ x: [2, 1] }))
  assert.notEqual(runtimeHash({ port: 443 }), runtimeHash({ port: 80 }))
})
