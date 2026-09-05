import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileManagedNodeOutbound, parseManagedNodeShareLink } from './managed-node.ts'

const LINK = 'vless://00000000-0000-4000-8000-000000000001@us.example.test:443?encryption=none&security=reality&sni=yahoo.com&fp=chrome&pbk=public-key&sid=abcd&type=tcp&flow=xtls-rprx-vision#US%20managed'

test('managed node adapter parses standard VLESS Reality link', () => {
  const d = parseManagedNodeShareLink(LINK)
  assert.equal(d.address, 'us.example.test')
  assert.equal(d.serverName, 'yahoo.com')
  assert.equal(d.name, 'US managed')
})

test('managed node adapter compiles Xray outbound', () => {
  const o: any = compileManagedNodeOutbound(LINK, 'land-us')
  assert.equal(o.tag, 'land-us')
  assert.equal(o.settings.vnext[0].users[0].id, '00000000-0000-4000-8000-000000000001')
  assert.equal(o.streamSettings.realitySettings.publicKey, 'public-key')
})

test('managed node adapter rejects incomplete Reality links', () => {
  assert.throws(() => parseManagedNodeShareLink('vless://id@example.test:443?security=reality'), /pbk\/sni/)
})
