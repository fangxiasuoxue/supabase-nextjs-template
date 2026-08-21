import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAccessNodeId, buildAccessStatRows, type AccessStatBucket, type AccessResolveCtx } from './access-ingest.ts'

const HOUR = '2026-08-20T12:00:00Z'

function ctx(over: Partial<AccessResolveCtx> = {}): AccessResolveCtx {
  return { emailToNode: new Map([['a@n', 'node-A']]), nodeIds: ['node-A', 'node-B'], ...over }
}

test('resolveAccessNodeId: email 命中', () => {
  assert.equal(resolveAccessNodeId('a@n', ctx()), 'node-A')
})

test('resolveAccessNodeId: 多节点匿名/未命中 → null', () => {
  assert.equal(resolveAccessNodeId('', ctx()), null)
  assert.equal(resolveAccessNodeId('ghost@n', ctx()), null)
})

test('resolveAccessNodeId: 单节点兜底(含匿名)', () => {
  const single = ctx({ nodeIds: ['node-A'], emailToNode: new Map() })
  assert.equal(resolveAccessNodeId('', single), 'node-A')
  assert.equal(resolveAccessNodeId('ghost@n', single), 'node-A')
})

test('buildAccessStatRows: 映射 + 字段', () => {
  const buckets: AccessStatBucket[] = [
    { bucket_hour: HOUR, email: 'a@n', domain: 'youtube.com', outbound_tag: 'direct', hits: 5, uniq_clients: 2 },
  ]
  const { rows, skipped } = buildAccessStatRows(buckets, ctx())
  assert.equal(skipped, 0)
  assert.deepEqual(rows, [
    { node_id: 'node-A', email: 'a@n', domain: 'youtube.com', outbound_tag: 'direct', bucket_hour: HOUR, hits: 5, uniq_clients: 2 },
  ])
})

test('buildAccessStatRows: 同主键聚合求和', () => {
  const single = ctx({ nodeIds: ['node-A'], emailToNode: new Map() })
  const buckets: AccessStatBucket[] = [
    { bucket_hour: HOUR, email: '', domain: 'x.com', outbound_tag: 'direct', hits: 3, uniq_clients: 1 },
    { bucket_hour: HOUR, email: '', domain: 'x.com', outbound_tag: 'direct', hits: 2, uniq_clients: 1 },
  ]
  const { rows } = buildAccessStatRows(buckets, single)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].hits, 5)
  assert.equal(rows[0].uniq_clients, 2)
})

test('buildAccessStatRows: 无法归属 + 缺 bucket_hour → skipped', () => {
  const buckets = [
    { bucket_hour: HOUR, email: 'ghost@n', domain: 'x', outbound_tag: '', hits: 1, uniq_clients: 1 },
    { bucket_hour: '', email: 'a@n', domain: 'x', outbound_tag: '', hits: 1, uniq_clients: 1 },
  ] as AccessStatBucket[]
  const { rows, skipped } = buildAccessStatRows(buckets, ctx())
  assert.equal(rows.length, 0)
  assert.equal(skipped, 2)
})

test('buildAccessStatRows: 不同 domain/outbound 不合并', () => {
  const buckets: AccessStatBucket[] = [
    { bucket_hour: HOUR, email: 'a@n', domain: 'x.com', outbound_tag: 'direct', hits: 1, uniq_clients: 1 },
    { bucket_hour: HOUR, email: 'a@n', domain: 'y.com', outbound_tag: 'direct', hits: 1, uniq_clients: 1 },
    { bucket_hour: HOUR, email: 'a@n', domain: 'x.com', outbound_tag: 'us8', hits: 1, uniq_clients: 1 },
  ]
  const { rows } = buildAccessStatRows(buckets, ctx())
  assert.equal(rows.length, 3)
})
