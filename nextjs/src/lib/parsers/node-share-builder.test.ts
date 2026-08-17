import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVlessRealityShareUrl, buildSubscription, buildRenderedConfig } from './node-share-builder.ts'

// 全部为虚构测试值,勿用真实凭据
const base = {
  uuid: '11111111-2222-3333-4444-555555555555',
  host: 'us8.ibfvps.dpdns.org',
  serverName: 'yahoo.com',
  publicKey: 'TEST_ONLY_fake_reality_public_key_000',
  shortId: 'abcdef0123',
  remark: 'US8-reality',
}

test('buildVlessRealityShareUrl: 标准 reality 链接结构正确', () => {
  const url = buildVlessRealityShareUrl(base)
  assert.ok(url.startsWith(`vless://${base.uuid}@us8.ibfvps.dpdns.org:443?`))
  assert.match(url, /security=reality/)
  assert.match(url, /sni=yahoo\.com/)
  assert.match(url, /flow=xtls-rprx-vision/)
  assert.match(url, /pbk=/)
  assert.match(url, /sid=abcdef0123/)
  assert.ok(url.endsWith('#US8-reality'))
})

test('buildVlessRealityShareUrl: 客户端链接不带 mldsa/pqv(仅服务端需要)', () => {
  const url = buildVlessRealityShareUrl(base)
  assert.ok(!/mldsa/i.test(url))
  assert.ok(!/pqv/i.test(url))
})

test('buildVlessRealityShareUrl: host 原样使用(不产生 gcp8 脏值)', () => {
  const url = buildVlessRealityShareUrl(base)
  assert.ok(url.includes('us8.ibfvps.dpdns.org'))
  assert.ok(!url.includes('gcp8'))
})

test('buildVlessRealityShareUrl: 缺必填参数抛错', () => {
  assert.throws(() => buildVlessRealityShareUrl({ ...base, uuid: '' }))
  assert.throws(() => buildVlessRealityShareUrl({ ...base, publicKey: '' }))
})

test('buildSubscription: base64 可还原为 \\n 分隔链接', () => {
  const links = ['vless://a@h1:443?x=1#n1', 'vless://b@h2:443?y=2#n2']
  const sub = buildSubscription(links)
  const decoded = Buffer.from(sub, 'base64').toString('utf-8')
  assert.equal(decoded, links.join('\n'))
})

test('buildRenderedConfig: 结构含 share_links + subscription', () => {
  const links = [buildVlessRealityShareUrl(base)]
  const rc = buildRenderedConfig(links)
  assert.deepEqual(rc.share_links, links)
  assert.equal(rc.subscription, buildSubscription(links))
})
