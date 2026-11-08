import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  nodeProtocolFromProfile,
  profileListen,
  isLoopbackListen,
  deployWarningsForProfile,
  NODE_PROTOCOLS,
} from './node-protocol.ts'
import { toSeatProtocol } from '../clients/node-client-admin.ts'

// 事故(2026-11-08):/app/admin/nodes 选「Shadowsocks · AES-128-GCM」模板建部署,
// deploy 路由把 nodes.protocol 硬编码成 'vless' → 列表显示 vless、席位按 vless 建 uuid 凭据、
// agent 向 SS 入站加 uuid 客户端被拒 "password must be provided as a string",下发列全红。
// 本测试锁死:节点协议只能来自模板。

test('nodeProtocolFromProfile: transport_protocol 是权威', () => {
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'shadowsocks' }), 'shadowsocks')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'vless' }), 'vless')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'socks' }), 'socks')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'trojan' }), 'trojan')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'vmess' }), 'vmess')
})

test('nodeProtocolFromProfile: 别名归一(ss→shadowsocks, socks5→socks, 大小写/空白)', () => {
  assert.equal(nodeProtocolFromProfile({ transport_protocol: ' SS ' }), 'shadowsocks')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'socks5' }), 'socks')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'Shadowsocks' }), 'shadowsocks')
})

test('nodeProtocolFromProfile: transport_protocol 缺省时退到 config_template.protocol', () => {
  assert.equal(nodeProtocolFromProfile({ transport_protocol: null, config_template: { protocol: 'shadowsocks' } }), 'shadowsocks')
  assert.equal(nodeProtocolFromProfile({ config_template: { protocol: 'socks' } }), 'socks')
})

test('nodeProtocolFromProfile: 未知/缺失 → 退回 vless(历史默认),且结果一定在 DB 词表内', () => {
  assert.equal(nodeProtocolFromProfile(null), 'vless')
  assert.equal(nodeProtocolFromProfile(undefined), 'vless')
  assert.equal(nodeProtocolFromProfile({ transport_protocol: 'wireguard' }), 'vless')
  for (const p of ['shadowsocks', 'vless', 'socks', 'ss', 'wireguard', null]) {
    assert.ok((NODE_PROTOCOLS as readonly string[]).includes(nodeProtocolFromProfile({ transport_protocol: p })))
  }
})

test('回归:SS 模板建出的节点,席位协议必须是 ss(与 node_clients_protocol_check 词表一致)', () => {
  const nodeProtocol = nodeProtocolFromProfile({ transport_protocol: 'shadowsocks', config_template: { method: 'aes-128-gcm' } })
  assert.equal(toSeatProtocol(nodeProtocol), 'ss')
  assert.equal(toSeatProtocol(nodeProtocolFromProfile({ transport_protocol: 'vless' })), 'vless')
})

test('profileListen / isLoopbackListen:识别只听本机回环的模板', () => {
  assert.equal(profileListen({ config_template: { listen: '127.0.0.1' } }), '127.0.0.1')
  assert.equal(profileListen({ config_template: {} }), null)
  assert.equal(profileListen(null), null)
  assert.equal(isLoopbackListen('127.0.0.1'), true)
  assert.equal(isLoopbackListen('::1'), true)
  assert.equal(isLoopbackListen('localhost'), true)
  assert.equal(isLoopbackListen('0.0.0.0'), false)
  assert.equal(isLoopbackListen(null), false)   // agent 缺省 0.0.0.0
})

test('deployWarningsForProfile:回环模板给出明确告警,公网模板无告警', () => {
  const w = deployWarningsForProfile({ name: 'Shadowsocks · AES-128-GCM', transport_protocol: 'shadowsocks', config_template: { listen: '127.0.0.1' } })
  assert.equal(w.length, 1)
  assert.match(w[0], /127\.0\.0\.1/)
  assert.deepEqual(deployWarningsForProfile({ transport_protocol: 'shadowsocks', config_template: { listen: '0.0.0.0' } }), [])
  assert.deepEqual(deployWarningsForProfile({ transport_protocol: 'vless', config_template: {} }), [])
})
