import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nodeSlug, buildSeatEmail, swapVlessUuid, extractBaseShareLink } from './node-client-admin.ts'

test('nodeSlug: 清洗为 a-z0-9-', () => {
  assert.equal(nodeSlug('vps-gcp-US8-reality'), 'vps-gcp-us8-reality')
  assert.equal(nodeSlug('  Node 名字!! '), 'node')
  assert.equal(nodeSlug(''), 'node')
  assert.equal(nodeSlug(null), 'node')
})

test('buildSeatEmail: NN 两位补零', () => {
  assert.equal(buildSeatEmail('us8', 1), 'us8-user01@node')
  assert.equal(buildSeatEmail('us8', 12), 'us8-user12@node')
})

const BASE =
  'vless://11111111-2222-3333-4444-555555555555@us8.ibfvps.dpdns.org:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=yahoo.com&fp=chrome&pbk=PBK&sid=abcd01&type=tcp#US8-base'

test('swapVlessUuid: 换 uuid 与 remark,保留 host/port/params', () => {
  const out = swapVlessUuid(BASE, '99999999-8888-7777-6666-555555555555', 'acme-user01')
  assert.ok(out.startsWith('vless://99999999-8888-7777-6666-555555555555@us8.ibfvps.dpdns.org:443?'))
  assert.match(out, /security=reality/)
  assert.match(out, /pbk=PBK/)
  assert.match(out, /sid=abcd01/)
  assert.ok(out.endsWith('#acme-user01'))
  // 不残留旧 uuid
  assert.ok(!out.includes('11111111-2222-3333-4444-555555555555'))
})

test('swapVlessUuid: 无 fragment 的 base 也能派生', () => {
  const noFrag = BASE.split('#')[0]
  const out = swapVlessUuid(noFrag, 'uuid-x', 'r')
  assert.ok(out.startsWith('vless://uuid-x@us8.ibfvps.dpdns.org:443?'))
  assert.ok(out.endsWith('#r'))
})

test('swapVlessUuid: 非 vless 链接抛错', () => {
  assert.throws(() => swapVlessUuid('http://x', 'u', 'r'))
})

test('extractBaseShareLink: 从 share_links / 字符串 / 兜底', () => {
  assert.equal(extractBaseShareLink({ share_links: [BASE] }), BASE)
  assert.equal(extractBaseShareLink(BASE), BASE)
  assert.equal(extractBaseShareLink({ subscription: 'x' }), null)
  assert.equal(extractBaseShareLink(null), null)
})
