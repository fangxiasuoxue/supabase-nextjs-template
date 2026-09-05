import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileCheapIpOutbound } from './cheap-ip.ts'

const asset = { connect_ip: '203.0.113.8', socks5_port: 1080, auth_username: 'demo-user', auth_password: 'demo-pass' }

test('cheap adapter compiles direct SOCKS5 outbound', () => {
  const o: any = compileCheapIpOutbound(asset, 'cheap-us01')
  assert.equal(o.settings.servers[0].address, '203.0.113.8')
  assert.equal(o.settings.servers[0].port, 1080)
})

test('cheap adapter composes with GoRelay loopback transport', () => {
  const o: any = compileCheapIpOutbound(asset, 'cheap-us01-gr', 'gorelay', 3101)
  assert.equal(o.settings.servers[0].address, '127.0.0.1')
  assert.equal(o.settings.servers[0].port, 3101)
})

test('cheap adapter rejects missing credentials or transport port', () => {
  assert.throws(() => compileCheapIpOutbound({ ...asset, auth_password: null }, 'bad'), /账密/)
  assert.throws(() => compileCheapIpOutbound(asset, 'bad', 'gorelay'), /地址\/端口/)
})
