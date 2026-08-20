import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveNodeId,
  emailDimension,
  buildTrafficStatRows,
  type HourlyXrayTraffic,
  type NodeResolveCtx,
} from './node-traffic-upsert.ts'

const HOUR = '2026-08-19T21:00:00Z'

function ctx(over: Partial<NodeResolveCtx> = {}): NodeResolveCtx {
  return {
    inboundTagToNode: new Map([['reality-in', 'node-A']]),
    emailToNode: new Map([['acme-user01@node', 'node-A']]),
    nodeIds: ['node-A', 'node-B'],
    ...over,
  }
}

test('resolveNodeId: inbound scope 按 inbound_tag 归节点', () => {
  assert.equal(resolveNodeId({ scope: 'inbound', tag: 'reality-in' }, ctx()), 'node-A')
})

test('resolveNodeId: user scope 按 email 归节点', () => {
  assert.equal(resolveNodeId({ scope: 'user', tag: 'acme-user01@node' }, ctx()), 'node-A')
})

test('resolveNodeId: 多节点下未匹配 → null(丢弃)', () => {
  assert.equal(resolveNodeId({ scope: 'user', tag: 'ghost@node' }, ctx()), null)
  assert.equal(resolveNodeId({ scope: 'inbound', tag: 'unknown-tag' }, ctx()), null)
})

test('resolveNodeId: 单节点 VPS 未匹配 → 兜底归唯一节点', () => {
  const single = ctx({ nodeIds: ['node-A'], inboundTagToNode: new Map(), emailToNode: new Map() })
  assert.equal(resolveNodeId({ scope: 'user', tag: 'ghost@node' }, single), 'node-A')
  assert.equal(resolveNodeId({ scope: 'inbound', tag: 'whatever' }, single), 'node-A')
})

test('emailDimension: user→tag,inbound→空串', () => {
  assert.equal(emailDimension({ scope: 'user', tag: 'x@n' }), 'x@n')
  assert.equal(emailDimension({ scope: 'inbound', tag: 'reality-in' }), '')
})

test('buildTrafficStatRows: inbound 归 node 级 email=""', () => {
  const traffic: HourlyXrayTraffic[] = [
    { hour_start: HOUR, scope: 'inbound', tag: 'reality-in', uplink_bytes: 100, downlink_bytes: 200 },
  ]
  const { rows, skipped } = buildTrafficStatRows(traffic, ctx())
  assert.equal(skipped, 0)
  assert.deepEqual(rows, [
    { node_id: 'node-A', email: '', bucket_hour: HOUR, uplink_bytes: 100, downlink_bytes: 200 },
  ])
})

test('buildTrafficStatRows: user 归终端级 email=tag', () => {
  const traffic: HourlyXrayTraffic[] = [
    { hour_start: HOUR, scope: 'user', tag: 'acme-user01@node', uplink_bytes: 10, downlink_bytes: 20 },
  ]
  const { rows } = buildTrafficStatRows(traffic, ctx())
  assert.deepEqual(rows, [
    { node_id: 'node-A', email: 'acme-user01@node', bucket_hour: HOUR, uplink_bytes: 10, downlink_bytes: 20 },
  ])
})

test('buildTrafficStatRows: 同主键多行按 (node,email,hour) 聚合求和', () => {
  // 单节点兜底会把 inbound 与未知 user 都归 node-A;其中两条 email='' 应合并
  const single = ctx({ nodeIds: ['node-A'], inboundTagToNode: new Map([['a', 'node-A'], ['b', 'node-A']]), emailToNode: new Map() })
  const traffic: HourlyXrayTraffic[] = [
    { hour_start: HOUR, scope: 'inbound', tag: 'a', uplink_bytes: 1, downlink_bytes: 2 },
    { hour_start: HOUR, scope: 'inbound', tag: 'b', uplink_bytes: 3, downlink_bytes: 4 },
  ]
  const { rows } = buildTrafficStatRows(traffic, single)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], {
    node_id: 'node-A', email: '', bucket_hour: HOUR, uplink_bytes: 4, downlink_bytes: 6,
  })
})

test('buildTrafficStatRows: 不同小时桶不合并', () => {
  const traffic: HourlyXrayTraffic[] = [
    { hour_start: '2026-08-19T21:00:00Z', scope: 'inbound', tag: 'reality-in', uplink_bytes: 1, downlink_bytes: 1 },
    { hour_start: '2026-08-19T22:00:00Z', scope: 'inbound', tag: 'reality-in', uplink_bytes: 2, downlink_bytes: 2 },
  ]
  const { rows } = buildTrafficStatRows(traffic, ctx())
  assert.equal(rows.length, 2)
})

test('buildTrafficStatRows: 无法归属 + 缺 hour_start 计入 skipped 且不产行', () => {
  const traffic: HourlyXrayTraffic[] = [
    { hour_start: HOUR, scope: 'user', tag: 'ghost@node', uplink_bytes: 5, downlink_bytes: 5 },
    { hour_start: '', scope: 'inbound', tag: 'reality-in', uplink_bytes: 9, downlink_bytes: 9 },
  ]
  const { rows, skipped } = buildTrafficStatRows(traffic, ctx())
  assert.equal(rows.length, 0)
  assert.equal(skipped, 2)
})

test('buildTrafficStatRows: 非法字节值降级为 0', () => {
  const traffic = [
    { hour_start: HOUR, scope: 'inbound', tag: 'reality-in', uplink_bytes: NaN, downlink_bytes: undefined },
  ] as unknown as HourlyXrayTraffic[]
  const { rows } = buildTrafficStatRows(traffic, ctx())
  assert.deepEqual(rows[0], {
    node_id: 'node-A', email: '', bucket_hour: HOUR, uplink_bytes: 0, downlink_bytes: 0,
  })
})
