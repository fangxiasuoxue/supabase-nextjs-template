import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { agentEnvKey, buildAgentBaseUrl } from './target'

/** Call one VPS agent without ever returning/logging its control credential. */
export async function callAgent(vpsId: string, path: string, options: RequestInit = {}): Promise<Response> {
  const admin = await createServerAdminClient()
  const { data: vps, error: vpsErr } = await admin.from('vps_instances')
    .select('id,instance_id,gcp_instance_name,public_ip,external_ip')
    .eq('id', vpsId).single()
  if (vpsErr || !vps) throw new Error(`VPS not found: ${vpsId}`)

  const instanceName = (vps as any).instance_id || (vps as any).gcp_instance_name || vpsId
  const token = process.env[agentEnvKey(instanceName)] || process.env.JIEDIAN_AGENT_CONTROL_TOKEN || ''
  // agent_tokens.token_hash is intentionally irreversible and must never be sent as a bearer token.
  if (!token) throw new Error(`Agent control secret is not configured for ${instanceName}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.JIEDIAN_AGENT_TIMEOUT_MS || 15000))
  try {
    return await fetch(`${buildAgentBaseUrl(vps as any)}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers, 'X-Auth-Token': token },
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}
