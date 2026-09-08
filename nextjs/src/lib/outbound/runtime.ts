import { extractBaseShareLink, swapVlessUuid } from '@/lib/clients/node-client-admin'
import { compileCheapIpOutbound } from './cheap-ip'
import { compileManagedNodeOutbound } from './managed-node'
import { compileSubscriptionOutbound } from './subscription'
import { fetchSubscriptionSecret, resolveEnvSecretRef } from './subscription-fetch'
export { runtimeHash } from './runtime-hash'

function localPort(ref: string | null): number | undefined {
  const match = String(ref || '').match(/^local-port:(\d+)$/)
  const port = Number(match?.[1])
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

function decorateTransport(outbound: any, kind: string, ref: string | null) {
  if (kind === 'direct') return outbound
  const port = localPort(ref)
  if (!port) throw new Error(`${kind} 缺少 local-port transport_ref`)
  const server = outbound.settings?.vnext?.[0] || outbound.settings?.servers?.[0]
  if (!server) throw new Error(`${kind} 暂不兼容该 Endpoint 结构`)
  server.address = '127.0.0.1'
  server.port = port
  return outbound
}

export async function compileCatalogOutbound(admin: any, row: any): Promise<Record<string, any>> {
  if (row.endpoint_kind === 'subscription_node') {
    const [{ data: source }, { data: item }] = await Promise.all([
      admin.from('outbound_sources').select('id,kind,secret_ref,status').eq('id', row.source_id).maybeSingle(),
      admin.from('outbound_source_items').select('id,external_key,status,compatibility').eq('id', row.source_item_id).maybeSingle(),
    ])
    if (!source || source.kind !== 'subscription' || source.status !== 'active' || !item || item.status !== 'active' || item.compatibility !== 'supported') {
      throw new Error('订阅 Source/Endpoint 当前不可部署')
    }
    const body = await fetchSubscriptionSecret(resolveEnvSecretRef(source.secret_ref))
    return decorateTransport(compileSubscriptionOutbound(body, item.external_key, row.tag), row.transport_kind, row.transport_ref)
  }

  if (row.endpoint_kind === 'managed_node') {
    const sourceNodeId = row.desired_config?.source_node_id
    const sourceClientId = row.desired_config?.source_client_id
    const [{ data: client }, { data: deployment }] = await Promise.all([
      admin.from('node_clients').select('id,node_id,cred_ref,enabled,purpose,last_reconciled_at').eq('id', sourceClientId).maybeSingle(),
      admin.from('node_deployments').select('rendered_config').eq('node_id', sourceNodeId).eq('status', 'success').not('rendered_config', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (!client || client.node_id !== sourceNodeId || client.purpose !== 'outbound_landing' || !client.enabled || !client.last_reconciled_at) {
      throw new Error('VLESS :443 专用落地 Client 尚未下发成功')
    }
    const base = extractBaseShareLink(deployment?.rendered_config)
    if (!base) throw new Error('自建落地没有成功部署的 VLESS 基链')
    const link = swapVlessUuid(base, client.cred_ref, row.display_name)
    return decorateTransport(compileManagedNodeOutbound(link, row.tag), row.transport_kind, row.transport_ref)
  }

  if (row.endpoint_kind === 'cheap_ip') {
    const ipId = row.desired_config?.ip_asset_id
    const { data: asset } = await admin.from('ip_assets').select('*').eq('id', ipId).is('deleted_at', null).maybeSingle()
    if (!asset) throw new Error('Cheap IP 已不存在')
    return compileCheapIpOutbound(asset, row.tag, row.transport_kind, localPort(row.transport_ref))
  }

  throw new Error(`Endpoint 类型 ${row.endpoint_kind} 暂不支持自动 Apply`)
}
