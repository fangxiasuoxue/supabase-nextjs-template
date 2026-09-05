import { NextRequest, NextResponse } from 'next/server'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
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

  const admin = await createServerAdminClient()
  const vpsId = await targetVps(admin, id)
  if (!vpsId) return NextResponse.json({ error: 'Node has no VPS runtime' }, { status: 409 })
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
