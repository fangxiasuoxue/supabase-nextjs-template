import { NextRequest, NextResponse } from 'next/server'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { extractBaseShareLink } from '@/lib/clients/node-client-admin'
import { compileManagedNodeOutbound, parseManagedNodeShareLink } from '@/lib/outbound/managed-node'
import { compileCheapIpOutbound } from '@/lib/outbound/cheap-ip'
import {
  assertNonSecretJson,
  OUTBOUND_ENDPOINT_KINDS,
  OUTBOUND_TRANSPORT_KINDS,
  safeText,
  validOutboundTag,
} from '@/lib/outbound/catalog'

async function targetVps(admin: any, nodeId: string): Promise<string | null> {
  const { data } = await admin.from('nodes').select('vps_instance_id').eq('id', nodeId).maybeSingle()
  return data?.vps_instance_id ?? null
}

// Safe selectable catalog for all Xray nodes sharing this VPS runtime.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'read')
  if ('error' in gate) return gate.error
  const admin = await createServerAdminClient()
  const vpsId = await targetVps(admin, id)
  if (!vpsId) return NextResponse.json({ error: 'Node has no VPS runtime' }, { status: 409 })

  const { data, error } = await (admin as any)
    .from('node_outbounds')
    .select('id,tag,display_name,endpoint_kind,transport_kind,transport_ref,desired_state,deploy_state,last_applied_at,last_observed_at,last_error,source_id,source_item_id')
    .eq('target_vps_instance_id', vpsId)
    .neq('desired_state', 'absent')
    .order('display_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target_vps_instance_id: vpsId, outbounds: data ?? [] })
}

// Register desired outbound metadata. Applying it to Xray is deliberately a separate audited action.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'manage')
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const admin = await createServerAdminClient()
  const vpsId = await targetVps(admin, id)
  if (!vpsId) return NextResponse.json({ error: 'Node has no VPS runtime' }, { status: 409 })

  if (body.action === 'import_managed_node') {
    return importManagedNode(admin, gate.user.id, vpsId, body)
  }
  if (body.action === 'import_cheap_ip') {
    return importCheapIp(admin, gate.user.id, vpsId, body)
  }

  const tag = safeText(body.tag)
  const displayName = safeText(body.display_name)
  const endpointKind = safeText(body.endpoint_kind)
  const transportKind = safeText(body.transport_kind || 'direct')
  const desiredConfig = body.desired_config ?? {}

  if (!validOutboundTag(tag)) return NextResponse.json({ error: 'tag 格式无效' }, { status: 400 })
  if (!displayName) return NextResponse.json({ error: 'display_name 必填' }, { status: 400 })
  if (!OUTBOUND_ENDPOINT_KINDS.has(endpointKind)) return NextResponse.json({ error: 'endpoint_kind 无效' }, { status: 400 })
  if (!OUTBOUND_TRANSPORT_KINDS.has(transportKind)) return NextResponse.json({ error: 'transport_kind 无效' }, { status: 400 })
  try { assertNonSecretJson(desiredConfig, 'desired_config') } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const row = {
    target_vps_instance_id: vpsId,
    source_id: body.source_id || null,
    source_item_id: body.source_item_id || null,
    tag,
    display_name: displayName,
    endpoint_kind: endpointKind,
    transport_kind: transportKind,
    transport_ref: safeText(body.transport_ref, 500) || null,
    desired_config: desiredConfig,
    deploy_state: 'draft',
    created_by: gate.user.id,
  }
  const { data, error } = await (admin as any).from('node_outbounds').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ outbound: data }, { status: 201 })
}

async function importCheapIp(admin: any, userId: string, targetVpsId: string, body: any) {
  const ipAssetId = Number(body.ip_asset_id)
  const tag = safeText(body.tag)
  const displayName = safeText(body.display_name)
  const transportKind = safeText(body.transport_kind || 'direct') as 'direct' | 'gorelay' | 'self_transit'
  const localPort = body.local_port == null || body.local_port === '' ? undefined : Number(body.local_port)
  if (!Number.isInteger(ipAssetId) || !validOutboundTag(tag) || !displayName) {
    return NextResponse.json({ error: 'ip_asset_id、合法 tag、display_name 必填' }, { status: 400 })
  }
  if (!OUTBOUND_TRANSPORT_KINDS.has(transportKind)) {
    return NextResponse.json({ error: 'transport_kind 无效' }, { status: 400 })
  }
  if (transportKind !== 'direct' && (!Number.isInteger(localPort) || localPort! < 1 || localPort! > 65535)) {
    return NextResponse.json({ error: 'GoRelay/self_transit 必须指定合法本机端口' }, { status: 400 })
  }

  const { data: asset } = await admin.from('ip_assets')
    .select('id,provider,remark,label,status,expires_at,deleted_at,ip,public_ip,connect_ip,socks5_port,auth_username,auth_password,country_code')
    .eq('id', ipAssetId).maybeSingle()
  const expired = asset?.expires_at && new Date(asset.expires_at).getTime() <= Date.now()
  if (!asset || asset.deleted_at || expired || String(asset.status || '').toLowerCase() !== 'active') {
    return NextResponse.json({ error: 'Cheap IP 不存在、已过期或不是 active' }, { status: 400 })
  }
  try {
    compileCheapIpOutbound(asset, tag, transportKind, localPort) // validation only; never persist returned secrets
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  let { data: source } = await admin.from('outbound_sources').select('id')
    .eq('kind', 'cheap_ip').eq('ip_asset_id', ipAssetId).maybeSingle()
  if (!source) {
    const inserted = await admin.from('outbound_sources').insert({
      name: asset.remark || asset.label || `Cheap IP #${asset.id}`,
      kind: 'cheap_ip', provider: asset.provider, ip_asset_id: asset.id,
      config: { origin: 'ip_assets' }, status: 'active', last_discovered_at: new Date().toISOString(), created_by: userId,
    }).select('id').single()
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 })
    source = inserted.data
  }
  const item = await admin.from('outbound_source_items').upsert({
    source_id: source.id, external_key: String(asset.id),
    display_name: asset.remark || asset.label || `Cheap IP #${asset.id}`,
    protocol: 'socks', region: asset.country_code || null,
    server_hint: asset.public_ip || asset.ip || null, port_hint: asset.socks5_port,
    secret_ref: `secret_ref://ip-assets/${asset.id}/socks5`, metadata: {}, compatibility: 'supported',
    status: 'active', observed_at: new Date().toISOString(),
  }, { onConflict: 'source_id,external_key' }).select('id').single()
  if (item.error) return NextResponse.json({ error: item.error.message }, { status: 500 })

  const { data, error } = await admin.from('node_outbounds').upsert({
    target_vps_instance_id: targetVpsId, source_id: source.id, source_item_id: item.data.id,
    tag, display_name: displayName, endpoint_kind: 'cheap_ip', transport_kind: transportKind,
    transport_ref: transportKind === 'direct' ? null : `local-port:${localPort}`,
    desired_config: { source: 'ip_assets', ip_asset_id: asset.id, ...(localPort ? { local_port: localPort } : {}) },
    desired_state: 'present', deploy_state: 'draft', created_by: userId,
  }, { onConflict: 'target_vps_instance_id,tag' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ outbound: data }, { status: 201 })
}

async function importManagedNode(admin: any, userId: string, targetVpsId: string, body: any) {
  const sourceNodeId = safeText(body.source_node_id)
  const tag = safeText(body.tag)
  const displayName = safeText(body.display_name)
  const transportKind = safeText(body.transport_kind || 'direct')
  if (!sourceNodeId || !validOutboundTag(tag) || !displayName) {
    return NextResponse.json({ error: 'source_node_id、合法 tag、display_name 必填' }, { status: 400 })
  }
  if (!OUTBOUND_TRANSPORT_KINDS.has(transportKind)) {
    return NextResponse.json({ error: 'transport_kind 无效' }, { status: 400 })
  }

  const { data: sourceNode } = await admin
    .from('nodes')
    .select('id,name,status,public_ip,port,last_deployed_at')
    .eq('id', sourceNodeId)
    .maybeSingle()
  if (!sourceNode || sourceNode.status !== 'active') {
    return NextResponse.json({ error: '源 managed node 不存在或不是 active' }, { status: 400 })
  }
  const { data: deployment } = await admin
    .from('node_deployments')
    .select('rendered_config,created_at')
    .eq('node_id', sourceNodeId)
    .eq('status', 'success')
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const shareLink = extractBaseShareLink(deployment?.rendered_config)
  if (!shareLink) return NextResponse.json({ error: '源节点没有成功部署的分享链接' }, { status: 409 })

  let descriptor
  try {
    descriptor = parseManagedNodeShareLink(shareLink)
    compileManagedNodeOutbound(shareLink, tag) // validate compile without persisting credentials
  } catch (e: any) {
    return NextResponse.json({ error: `源节点暂不兼容: ${e.message}` }, { status: 400 })
  }

  let { data: source } = await admin
    .from('outbound_sources')
    .select('id')
    .eq('kind', 'managed_node')
    .eq('managed_node_id', sourceNodeId)
    .maybeSingle()
  if (!source) {
    const inserted = await admin.from('outbound_sources').insert({
      name: sourceNode.name,
      kind: 'managed_node',
      managed_node_id: sourceNodeId,
      config: { origin: 'console_node' },
      status: 'active',
      last_discovered_at: new Date().toISOString(),
      created_by: userId,
    }).select('id').single()
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 })
    source = inserted.data
  }

  const itemInsert = await admin.from('outbound_source_items').upsert({
    source_id: source.id,
    external_key: sourceNodeId,
    display_name: sourceNode.name,
    protocol: descriptor.protocol,
    region: null,
    server_hint: descriptor.address,
    port_hint: descriptor.port,
    secret_ref: `secret_ref://managed-node/${sourceNodeId}/latest-share`,
    metadata: { security: descriptor.security, network: descriptor.network },
    compatibility: 'supported',
    status: 'active',
    observed_at: new Date().toISOString(),
  }, { onConflict: 'source_id,external_key' }).select('id').single()
  if (itemInsert.error) return NextResponse.json({ error: itemInsert.error.message }, { status: 500 })

  const { data, error } = await admin.from('node_outbounds').upsert({
    target_vps_instance_id: targetVpsId,
    source_id: source.id,
    source_item_id: itemInsert.data.id,
    tag,
    display_name: displayName,
    endpoint_kind: 'managed_node',
    transport_kind: transportKind,
    transport_ref: safeText(body.transport_ref, 500) || null,
    desired_config: { source: 'managed_node', source_node_id: sourceNodeId },
    desired_state: 'present',
    deploy_state: 'draft',
    created_by: userId,
  }, { onConflict: 'target_vps_instance_id,tag' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ outbound: data, source_item: { ...descriptor, publicKey: undefined } }, { status: 201 })
}
