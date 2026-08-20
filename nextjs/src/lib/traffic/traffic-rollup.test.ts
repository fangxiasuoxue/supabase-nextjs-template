import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rollupTraffic, type TrafficStatRow } from './traffic-rollup.ts'

test('rollupTraffic: node 级(email="")汇总 + 终端级按 email 累加', () => {
  const rows: TrafficStatRow[] = [
    { email: '', uplink_bytes: 100, downlink_bytes: 200 }, // node 桶1
    { email: '', uplink_bytes: 50, downlink_bytes: 50 }, // node 桶2
    { email: 'a@n', uplink_bytes: 10, downlink_bytes: 20 },
    { email: 'a@n', uplink_bytes: 5, downlink_bytes: 5 },
    { email: 'b@n', uplink_bytes: 300, downlink_bytes: 0 },
  ]
  const r = rollupTraffic(rows)
  assert.equal(r.node_uplink_bytes, 150)
  assert.equal(r.node_downlink_bytes, 250)
  assert.equal(r.node_total_bytes, 400)
  assert.equal(r.terminals.length, 2)
})

test('rollupTraffic: 终端按 total 降序', () => {
  const rows: TrafficStatRow[] = [
    { email: 'a@n', uplink_bytes: 10, downlink_bytes: 20 }, // 30
    { email: 'b@n', uplink_bytes: 300, downlink_bytes: 0 }, // 300
  ]
  const r = rollupTraffic(rows)
  assert.equal(r.terminals[0].email, 'b@n')
  assert.equal(r.terminals[0].total_bytes, 300)
  assert.equal(r.terminals[1].email, 'a@n')
  assert.equal(r.terminals[1].total_bytes, 30)
})

test('rollupTraffic: 空 → 全 0', () => {
  const r = rollupTraffic([])
  assert.equal(r.node_total_bytes, 0)
  assert.deepEqual(r.terminals, [])
})

test('rollupTraffic: 非法字节按 0', () => {
  const rows = [
    { email: 'a@n', uplink_bytes: NaN, downlink_bytes: undefined },
  ] as unknown as TrafficStatRow[]
  const r = rollupTraffic(rows)
  assert.equal(r.terminals[0].total_bytes, 0)
})

test('rollupTraffic: 同 total 按 email 稳定排序', () => {
  const rows: TrafficStatRow[] = [
    { email: 'z@n', uplink_bytes: 5, downlink_bytes: 5 },
    { email: 'a@n', uplink_bytes: 5, downlink_bytes: 5 },
  ]
  const r = rollupTraffic(rows)
  assert.equal(r.terminals[0].email, 'a@n')
  assert.equal(r.terminals[1].email, 'z@n')
})
