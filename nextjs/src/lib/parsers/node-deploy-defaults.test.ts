import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveSite, deriveNodeDefaults } from './node-deploy-defaults.ts'

test('deriveSite: 从长名 name 首段取 sitecode(修 gcp8 bug)', () => {
  // 这正是 us8 部署卡住的场景:name=长名,gcp_instance_name=短名
  assert.equal(deriveSite({ name: 'us8-20260816-065259', gcp_instance_name: 'gcp8' }), 'us8')
})

test('deriveSite: 绝不返回短名 gcp8', () => {
  const s = deriveSite({ name: 'us8-20260816-065259', gcp_instance_name: 'gcp8' })
  assert.notEqual(s, 'gcp8')
})

test('deriveSite: name 缺失时 gcpN → usN 兜底', () => {
  assert.equal(deriveSite({ name: '', gcp_instance_name: 'gcp8' }), 'us8')
  assert.equal(deriveSite({ name: null, gcp_instance_name: 'gcp5' }), 'us5')
})

test('deriveSite: 两者皆空 → 空串,不炸', () => {
  assert.equal(deriveSite({}), '')
})

test('deriveNodeDefaults: us8 全套默认值正确', () => {
  const d = deriveNodeDefaults({ name: 'us8-20260816-065259', gcp_instance_name: 'gcp8' })
  assert.equal(d.site, 'us8')
  assert.equal(d.nodeName, 'US8-reality')
  assert.equal(d.inboundTag, 'jd-land-us8')
  assert.equal(d.host, 'us8.ibfvps.dpdns.org')
  assert.equal(d.port, 443)
})

test('deriveNodeDefaults: 不产生 gcp8 相关脏值', () => {
  const d = deriveNodeDefaults({ name: 'us8-20260816-065259', gcp_instance_name: 'gcp8' })
  assert.ok(!d.inboundTag.includes('gcp8'))
  assert.ok(!d.host.includes('gcp8'))
})

test('deriveNodeDefaults: 自定义域名后缀', () => {
  const d = deriveNodeDefaults({ name: 'us3-x' }, { domainSuffix: 'example.org' })
  assert.equal(d.host, 'us3.example.org')
})
