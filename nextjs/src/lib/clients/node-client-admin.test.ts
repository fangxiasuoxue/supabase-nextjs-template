import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  nodeSlug, buildSeatEmail, swapVlessUuid, extractBaseShareLink,
  toSeatProtocol, generateSeatCredential, ssMethodFromProfile, buildSeatShareLink,
} from './node-client-admin.ts'

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

test('toSeatProtocol: 节点协议 → DB 词表(shadowsocks→ss,其余保守落 vless)', () => {
  assert.equal(toSeatProtocol('shadowsocks'), 'ss')
  assert.equal(toSeatProtocol('ss'), 'ss')
  assert.equal(toSeatProtocol('Shadowsocks '), 'ss')
  assert.equal(toSeatProtocol('vless'), 'vless')
  assert.equal(toSeatProtocol('vmess'), 'vmess')
  assert.equal(toSeatProtocol('trojan'), 'trojan')
  assert.equal(toSeatProtocol('socks'), 'vless')
  assert.equal(toSeatProtocol(null), 'vless')
})

test('generateSeatCredential: ss 为 24 字符 base64url 密码,vless 为 uuid', () => {
  const pw = generateSeatCredential('ss')
  assert.equal(pw.length, 24)
  assert.match(pw, /^[A-Za-z0-9_-]+$/)
  assert.notEqual(pw, generateSeatCredential('ss'))
  assert.match(generateSeatCredential('vless'), /^[0-9a-f-]{36}$/)
})

test('ssMethodFromProfile: 取 config_template.method,缺省 aes-128-gcm', () => {
  assert.equal(ssMethodFromProfile({ method: 'chacha20-ietf-poly1305' }), 'chacha20-ietf-poly1305')
  assert.equal(ssMethodFromProfile({ listen: '127.0.0.1' }), 'aes-128-gcm')
  assert.equal(ssMethodFromProfile(null), 'aes-128-gcm')
})

test('buildSeatShareLink: SS 节点由字段拼链接,不依赖 base;缺 host/port 返回 null', () => {
  const node = { protocol: 'shadowsocks', public_ip: 'hk4.example.test', port: 2433, ss_method: 'aes-128-gcm', base_link: null }
  const link = buildSeatShareLink(node, { cred_ref: 'TEST_ONLY_pw', label: 'hk4-ss-user01', email: 'x@node' })
  assert.ok(link && link.startsWith('ss://'), String(link))
  assert.ok(link!.endsWith('@hk4.example.test:2433#hk4-ss-user01'))
  assert.equal(buildSeatShareLink({ ...node, port: null }, { cred_ref: 'p' }), null)
  assert.equal(buildSeatShareLink({ ...node, public_ip: null }, { cred_ref: 'p' }), null)
  assert.equal(buildSeatShareLink(node, { cred_ref: null }), null)
})

test('buildSeatShareLink: vless 节点沿用 base 换 uuid;无 base 返回 null', () => {
  const node = { protocol: 'vless', public_ip: 'us8.example.test', port: 443, base_link: BASE }
  const link = buildSeatShareLink(node, { cred_ref: '99999999-8888-7777-6666-555555555555', email: 'us8-user01@node' })
  assert.ok(link && link.startsWith('vless://99999999-8888-7777-6666-555555555555@us8.ibfvps.dpdns.org:443?'))
  assert.ok(link!.endsWith('#us8-user01%40node')) // remark 经 encodeURIComponent,与 swapVlessUuid 既有行为一致
  assert.equal(buildSeatShareLink({ ...node, base_link: null }, { cred_ref: 'u' }), null)
  assert.equal(buildSeatShareLink(null, { cred_ref: 'u' }), null)
})
