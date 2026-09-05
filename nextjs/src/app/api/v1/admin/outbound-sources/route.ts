import { NextRequest, NextResponse } from 'next/server'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { assertNonSecretJson, OUTBOUND_SOURCE_KINDS, safeText, validSecretRef } from '@/lib/outbound/catalog'

function publicSource(row: any) {
  const { secret_ref, ...safe } = row
  return {
    ...safe,
    has_secret: !!secret_ref,
    secret_ref_scheme: secret_ref ? String(secret_ref).split('://', 1)[0] : null,
  }
}

// Source catalog is global, but callers must identify a node they can manage/read.
export async function GET(req: NextRequest) {
  const nodeId = req.nextUrl.searchParams.get('node_id') || ''
  const gate = await requireNodeAccess(nodeId, 'read')
  if ('error' in gate) return gate.error
  const admin = await createServerAdminClient()
  const [{ data, error }, { data: items }, { data: nodes }, { data: ips }] = await Promise.all([
    (admin as any)
      .from('outbound_sources')
      .select('id,name,kind,provider,secret_ref,ip_asset_id,managed_node_id,config,status,last_discovered_at,last_error,created_at,updated_at')
      .order('name'),
    (admin as any)
      .from('outbound_source_items')
      .select('id,source_id,external_key,display_name,protocol,region,server_hint,port_hint,compatibility,status,observed_at')
      .order('display_name'),
    admin
      .from('nodes')
      .select('id,name,status,public_ip,port,last_deployed_at')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name'),
    admin
      .from('ip_assets')
      .select('id,provider,remark,label,status,country_code,expires_at')
      .is('deleted_at', null)
      .order('remark'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    sources: (data ?? []).map(publicSource),
    items: items ?? [],
    candidates: { managed_nodes: nodes ?? [], cheap_ips: ips ?? [] },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const nodeId = safeText(body.node_id)
  const gate = await requireNodeAccess(nodeId, 'manage')
  if ('error' in gate) return gate.error

  const kind = safeText(body.kind)
  const name = safeText(body.name)
  const secretRef = body.secret_ref == null ? null : safeText(body.secret_ref, 500)
  const config = body.config ?? {}
  if (!name) return NextResponse.json({ error: 'name 必填' }, { status: 400 })
  if (!OUTBOUND_SOURCE_KINDS.has(kind)) return NextResponse.json({ error: 'kind 无效' }, { status: 400 })
  if (secretRef && !validSecretRef(secretRef)) {
    return NextResponse.json({ error: 'secret_ref 仅支持 jms://、bw://、env://、secret_ref://' }, { status: 400 })
  }
  if (kind === 'cheap_ip' && !body.ip_asset_id) return NextResponse.json({ error: 'cheap_ip 必须引用 ip_asset_id' }, { status: 400 })
  if (kind === 'subscription' && !secretRef) return NextResponse.json({ error: 'subscription URL 必须存入密管并提供 secret_ref' }, { status: 400 })
  if (kind === 'managed_node' && !body.managed_node_id) return NextResponse.json({ error: 'managed_node_id 必填' }, { status: 400 })
  try { assertNonSecretJson(config) } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const admin = await createServerAdminClient()
  const { data, error } = await (admin as any).from('outbound_sources').insert({
    name,
    kind,
    provider: safeText(body.provider) || null,
    secret_ref: secretRef,
    ip_asset_id: body.ip_asset_id || null,
    managed_node_id: body.managed_node_id || null,
    config,
    status: 'draft',
    created_by: gate.user.id,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: publicSource(data) }, { status: 201 })
}
