import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agentEnvKey, buildAgentBaseUrl } from './target.ts'

test('agent env key uses stable instance name', () => {
  assert.equal(agentEnvKey('sz1'), 'JIEDIAN_AGENT_SZ1_TOKEN')
  assert.equal(agentEnvKey('gcp-us_1'), 'JIEDIAN_AGENT_GCP_US_1_TOKEN')
})

test('agent URL uses external fallback and port 4948', () => {
  assert.equal(buildAgentBaseUrl({ public_ip: null, external_ip: '120.79.22.106' }), 'http://120.79.22.106:4948')
  assert.equal(buildAgentBaseUrl({ public_ip: '1.2.3.4', external_ip: null }, 5000), 'http://1.2.3.4:5000')
})
