import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rollupAccess, type AccessStatRow } from './access-rollup.ts'

const rows: AccessStatRow[] = [
  { email: 'a@n', domain: 'youtube.com', outbound_tag: 'direct', hits: 10, uniq_clients: 2 },
  { email: 'a@n', domain: 'github.com', outbound_tag: 'direct', hits: 3, uniq_clients: 1 },
  { email: 'b@n', domain: 'youtube.com', outbound_tag: 'us8', hits: 5, uniq_clients: 1 },
  { email: '', domain: 'ads.example', outbound_tag: 'blocked', hits: 2, uniq_clients: 1 },
]

test('rollupAccess: total + Top域名降序合并', () => {
  const r = rollupAccess(rows)
  assert.equal(r.total_hits, 20)
  assert.equal(r.top_domains[0].domain, 'youtube.com')
  assert.equal(r.top_domains[0].hits, 15) // 10 + 5(跨终端合并)
})

test('rollupAccess: 终端画像 hits + uniq_domains', () => {
  const r = rollupAccess(rows)
  const a = r.by_terminal.find((t) => t.email === 'a@n')!
  assert.equal(a.hits, 13)
  assert.equal(a.uniq_domains, 2) // youtube + github
  const anon = r.by_terminal.find((t) => t.email === '(anonymous)')!
  assert.equal(anon.hits, 2)
})

test('rollupAccess: 分流体检(by_outbound)降序', () => {
  const r = rollupAccess(rows)
  assert.equal(r.by_outbound[0].outbound_tag, 'direct') // 13
  assert.equal(r.by_outbound[0].hits, 13)
  const blocked = r.by_outbound.find((o) => o.outbound_tag === 'blocked')!
  assert.equal(blocked.hits, 2)
})

test('rollupAccess: 空/占位', () => {
  const r = rollupAccess([])
  assert.equal(r.total_hits, 0)
  assert.deepEqual(r.top_domains, [])
})

test('rollupAccess: topN 截断', () => {
  const many: AccessStatRow[] = Array.from({ length: 30 }, (_, i) => ({
    email: 'a@n', domain: `d${i}.com`, outbound_tag: 'direct', hits: 30 - i, uniq_clients: 1,
  }))
  const r = rollupAccess(many, 5)
  assert.equal(r.top_domains.length, 5)
  assert.equal(r.top_domains[0].domain, 'd0.com')
})
