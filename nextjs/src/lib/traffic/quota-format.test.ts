import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatBytes, quotaPercent, quotaLevel } from './quota-format.ts'

test('formatBytes: 各量级', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1.00 KB')
  assert.equal(formatBytes(1536), '1.50 KB')
  assert.equal(formatBytes(10 * 1024), '10.0 KB')
  assert.equal(formatBytes(5 * 1024 * 1024 * 1024), '5.00 GB')
})

test('formatBytes: 非法/负数 → 0 B', () => {
  assert.equal(formatBytes(null), '0 B')
  assert.equal(formatBytes(undefined), '0 B')
  assert.equal(formatBytes(NaN), '0 B')
  assert.equal(formatBytes(-5), '0 B')
})

test('quotaPercent: 无配额 → null', () => {
  assert.equal(quotaPercent(100, null), null)
  assert.equal(quotaPercent(100, 0), null)
  assert.equal(quotaPercent(100, -1), null)
})

test('quotaPercent: 计算', () => {
  assert.equal(quotaPercent(50, 100), 50)
  assert.equal(quotaPercent(150, 100), 150) // 可 >100
  assert.equal(quotaPercent(null, 100), 0)
  assert.equal(quotaPercent(-5, 100), 0)
})

test('quotaLevel: 档位边界', () => {
  assert.equal(quotaLevel(0, null), 'none')
  assert.equal(quotaLevel(10, 100), 'ok')
  assert.equal(quotaLevel(79, 100), 'ok')
  assert.equal(quotaLevel(80, 100), 'warn') // 80% 起 warn
  assert.equal(quotaLevel(99, 100), 'warn')
  assert.equal(quotaLevel(100, 100), 'over') // 100% 起 over
  assert.equal(quotaLevel(250, 100), 'over')
})
