import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeSubscriptionLinks, describeXraySubscription } from './subscription.ts'

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
