import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileSubscriptionOutbound, decodeSubscriptionLinks, describeSubscriptionLink, describeXraySubscription } from './subscription.ts'

const vless = 'vless://00000000-0000-4000-8000-000000000001@us.example.test:443?security=reality&sni=yahoo.com&pbk=public#US%2001'
const trojan = 'trojan://password@sg.example.test:443?sni=sg.example.test#SG%2001'
const vmessPayload = Buffer.from(JSON.stringify({ v: '2', ps: 'VMess JP', add: 'jp.example.test', port: '443', id: 'secret' })).toString('base64')
const vmess = `vmess://${vmessPayload}`

test('decodes sublink-worker /xray base64 output into protocol links', () => {
  const body = Buffer.from([vless, trojan, vmess].join('\n')).toString('base64')
  assert.deepEqual(decodeSubscriptionLinks(body), [vless, trojan, vmess])
})

test('creates safe descriptors without raw credentials', () => {
  const rows = describeXraySubscription(Buffer.from([vless, trojan, vmess].join('\n')).toString('base64'))
  assert.deepEqual(rows.map((x) => x.protocol), ['vless', 'trojan', 'vmess'])
  assert.deepEqual(rows.map((x) => x.display_name), ['US 01', 'SG 01', 'VMess JP'])
  const serialized = JSON.stringify(rows)
  assert.equal(serialized.includes('00000000-0000-4000-8000-000000000001'), false)
  assert.equal(serialized.includes('password'), false)
  assert.equal(serialized.includes('secret'), false)
})

test('marks protocols unsupported by Xray compiler instead of silently converting', () => {
  const row = describeXraySubscription('hy2://password@hy.example.test:443#HY')
  assert.equal(row[0].compatibility, 'unsupported')
})

test('compiles VLESS Reality endpoint into an Xray outbound', () => {
  const link = 'vless://00000000-0000-4000-8000-000000000001@us.example.test:443?security=reality&sni=yahoo.com&pbk=public-key&sid=abcd&fp=chrome&flow=xtls-rprx-vision&type=tcp#US'
  const out = compileSubscriptionOutbound(link, describeSubscriptionLink(link).external_key, 'sub-us') as any
  assert.equal(out.tag, 'sub-us')
  assert.equal(out.protocol, 'vless')
  assert.equal(out.settings.vnext[0].users[0].id, '00000000-0000-4000-8000-000000000001')
  assert.equal(out.streamSettings.realitySettings.publicKey, 'public-key')
  assert.equal(out.streamSettings.realitySettings.serverName, 'yahoo.com')
})

test('compiles VMess websocket TLS endpoint', () => {
  const payload = Buffer.from(JSON.stringify({ v: '2', ps: 'JP', add: 'jp.example.test', port: '443', id: '00000000-0000-4000-8000-000000000002', aid: '0', net: 'ws', host: 'cdn.example.test', path: '/ws', tls: 'tls', sni: 'jp.example.test' })).toString('base64')
  const link = `vmess://${payload}`
  const out = compileSubscriptionOutbound(link, describeSubscriptionLink(link).external_key, 'sub-jp') as any
  assert.equal(out.protocol, 'vmess')
  assert.equal(out.streamSettings.network, 'ws')
  assert.equal(out.streamSettings.wsSettings.headers.Host, 'cdn.example.test')
  assert.equal(out.streamSettings.tlsSettings.serverName, 'jp.example.test')
})

test('compiles SIP002 Shadowsocks and Trojan TLS endpoints', () => {
  const ssLink = `ss://${Buffer.from('aes-256-gcm:p@ss').toString('base64url')}@ss.example.test:8388#SS`
  const ssOut = compileSubscriptionOutbound(ssLink, describeSubscriptionLink(ssLink).external_key, 'sub-ss') as any
  assert.deepEqual(ssOut.settings.servers[0], { address: 'ss.example.test', port: 8388, method: 'aes-256-gcm', password: 'p@ss' })

  const trLink = 'trojan://p%40ss@tr.example.test:443?security=tls&sni=edge.example.test&type=grpc&serviceName=tunnel#TR'
  const trOut = compileSubscriptionOutbound(trLink, describeSubscriptionLink(trLink).external_key, 'sub-tr') as any
  assert.equal(trOut.settings.servers[0].password, 'p@ss')
  assert.equal(trOut.streamSettings.grpcSettings.serviceName, 'tunnel')
})

test('compiler rejects an unknown item and unsupported protocol without leaking raw link', () => {
  assert.throws(() => compileSubscriptionOutbound(vless, 'missing', 'x'), /Endpoint/)
  const hy = 'hy2://password@hy.example.test:443#HY'
  assert.throws(() => compileSubscriptionOutbound(hy, describeSubscriptionLink(hy).external_key, 'x'), /暂不支持/)
})
