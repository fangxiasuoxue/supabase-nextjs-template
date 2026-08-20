import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isClientEnrolled,
  toDesiredClient,
  buildDesiredResponse,
  type NodeClientRow,
} from './node-client-desired.ts'

// 全部为虚构测试值,勿用真实凭据
const NOW = Math.floor(Date.parse('2026-08-19T12:00:00Z') / 1000)
const baseRow: NodeClientRow = {
  node_id: 'node-1',
  email: 'acme-user01@node',
  cred_ref: '11111111-2222-3333-4444-555555555555',
  protocol: 'vless',
  enabled: true,
  expires_at: null,
  ip_limit: null,
}

test('isClientEnrolled: 启用且不过期 → 在册', () => {
  assert.equal(isClientEnrolled({ enabled: true, expires_at: null }, NOW), true)
})

test('isClientEnrolled: 停用 → 离册(即使未到期)', () => {
  assert.equal(isClientEnrolled({ enabled: false, expires_at: null }, NOW), false)
})

test('isClientEnrolled: 未到期 → 在册', () => {
  assert.equal(isClientEnrolled({ enabled: true, expires_at: '2026-08-19T13:00:00Z' }, NOW), true)
})

test('isClientEnrolled: 已到期 → 离册', () => {
  assert.equal(isClientEnrolled({ enabled: true, expires_at: '2026-08-19T11:00:00Z' }, NOW), false)
})

test('isClientEnrolled: 到期时间不可解析 → 保守离册', () => {
  assert.equal(isClientEnrolled({ enabled: true, expires_at: 'not-a-date' }, NOW), false)
})

test('toDesiredClient: cred_ref 映射为 cred,带 inbound_tag 与 enrolled', () => {
  const tags = new Map<string, string | null>([['node-1', 'jd-land-us8']])
  const d = toDesiredClient(baseRow, tags, NOW)
  assert.equal(d.cred, baseRow.cred_ref)
  assert.equal(d.inbound_tag, 'jd-land-us8')
  assert.equal(d.email, 'acme-user01@node')
  assert.equal(d.enrolled, true)
  assert.equal(d.quota_bytes, null) // P1 未设配额 → null
})

test('toDesiredClient: node 无 inbound_tag 映射 → null(不抛)', () => {
  const d = toDesiredClient(baseRow, new Map(), NOW)
  assert.equal(d.inbound_tag, null)
})

test('toDesiredClient: 停用项 enrolled=false 但仍下发(agent 据此 RemoveUser)', () => {
  const tags = new Map<string, string | null>([['node-1', 'jd-land-us8']])
  const d = toDesiredClient({ ...baseRow, enabled: false }, tags, NOW)
  assert.equal(d.enrolled, false)
  assert.equal(d.enabled, false)
})

test('buildDesiredResponse: 全集下发,顺序保持', () => {
  const rows: NodeClientRow[] = [
    baseRow,
    { ...baseRow, email: 'acme-user02@node', expires_at: '2026-08-19T11:00:00Z' }, // 已到期
  ]
  const tags = new Map<string, string | null>([['node-1', 'jd-land-us8']])
  const res = buildDesiredResponse(rows, tags, NOW)
  assert.equal(res.clients.length, 2)
  assert.equal(res.clients[0].enrolled, true)
  assert.equal(res.clients[1].enrolled, false) // 到期
  assert.equal(res.clients[1].email, 'acme-user02@node')
})
