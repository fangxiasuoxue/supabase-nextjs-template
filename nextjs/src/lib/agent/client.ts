import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

/**
 * 向指定 VPS 的 jiedian-agent 发送请求。
 * 控制面永远不直接持有 agent 地址，统一通过此函数查询 vps_instances + agent_tokens。
 */
export async function callAgent(
  vpsId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const adminClient = await createServerAdminClient()

  // 查询有效的 agent token
  const { data: tokenRow, error: tokenErr } = await adminClient
    .from('agent_tokens' as any)
    .select('token_hash, instance_id')
    .eq('instance_id', vpsId)
    .eq('status', 'active')
    .single()

  if (tokenErr || !tokenRow) {
    throw new Error(`No active agent token for VPS ${vpsId}: ${tokenErr?.message}`)
  }

  // 查询 VPS 公网 IP
  const { data: vps, error: vpsErr } = await adminClient
    .from('vps_instances' as any)
    .select('public_ip')
    .eq('id', vpsId)
    .single()

  if (vpsErr || !vps) {
    throw new Error(`VPS not found: ${vpsId}: ${vpsErr?.message}`)
  }

  const url = `http://${(vps as any).public_ip}:8080${path}`

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'X-Auth-Token': (tokenRow as any).token_hash,
    },
  })
}
