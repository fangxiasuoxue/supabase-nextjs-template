import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

async function requireAdmin() {
  const ssr = await createSSRClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await ssr.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  if ((role as any)?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { error: null }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const { id: userId } = await ctx.params
  const admin = await createServerAdminClient() as any

  const [vpsAllocRes, grantsRes, ipAllocRes] = await Promise.all([
    admin.from('vps_allocations').select('id, vps_id, state, allocated_at, notes').or(`owner.eq.${userId},assigned_to.eq.${userId}`).eq('state', 'allocated'),
    admin.from('access_grants').select('id, resource_type, resource_id, level, created_at').eq('user_id', userId),
    admin.from('ip_allocations').select('id, ip_id, state, allocated_at, notes, display_name, terminate_at_period_end').eq('assignee_user_id', userId).eq('state', 'allocated').is('released_at', null),
  ])
  if (vpsAllocRes.error) return NextResponse.json({ error: vpsAllocRes.error.message }, { status: 500 })
  if (grantsRes.error) return NextResponse.json({ error: grantsRes.error.message }, { status: 500 })
  if (ipAllocRes.error) return NextResponse.json({ error: ipAllocRes.error.message }, { status: 500 })

  const grants = grantsRes.data || []
  const vpsIds = Array.from(new Set([...(vpsAllocRes.data || []).map((a: any) => a.vps_id), ...grants.filter((g: any) => g.resource_type === 'vps').map((g: any) => g.resource_id)].filter(Boolean)))
  const nodeIds = Array.from(new Set(grants.filter((g: any) => g.resource_type === 'node').map((g: any) => g.resource_id).filter(Boolean)))
  const clientIds = Array.from(new Set(grants.filter((g: any) => g.resource_type === 'node_client').map((g: any) => g.resource_id).filter(Boolean)))
  const ipIds = Array.from(new Set((ipAllocRes.data || []).map((a: any) => a.ip_id).filter(Boolean)))

  const [vpsRes, nodeRes, clientRes, ipRes] = await Promise.all([
    vpsIds.length ? admin.from('vps_instances').select('id, name, gcp_instance_name, provider, region, public_ip, status').in('id', vpsIds) : Promise.resolve({ data: [], error: null }),
    nodeIds.length ? admin.from('nodes').select('id, name, remark, public_ip, status, vps_instance_id').in('id', nodeIds) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? admin.from('node_clients').select('id, email, label, node_id, enabled, expires_at').in('id', clientIds) : Promise.resolve({ data: [], error: null }),
    ipIds.length ? admin.from('ip_assets').select('id, label, remark, ip, provider, provider_id, status').in('id', ipIds) : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [vpsRes, nodeRes, clientRes, ipRes]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  }

  const vpsById = new Map((vpsRes.data || []).map((r: any) => [r.id, r]))
  const nodeById = new Map((nodeRes.data || []).map((r: any) => [r.id, r]))
  const clientById = new Map((clientRes.data || []).map((r: any) => [r.id, r]))
  const ipById = new Map((ipRes.data || []).map((r: any) => [r.id, r]))

  return NextResponse.json({
    vps: vpsIds.map((vid) => ({ allocation: (vpsAllocRes.data || []).find((a: any) => a.vps_id === vid) || null, grant: grants.find((g: any) => g.resource_type === 'vps' && g.resource_id === vid) || null, asset: vpsById.get(vid) || { id: vid } })),
    nodes: nodeIds.map((nid) => ({ grant: grants.find((g: any) => g.resource_type === 'node' && g.resource_id === nid), asset: nodeById.get(nid) || { id: nid } })),
    clients: clientIds.map((cid) => ({ grant: grants.find((g: any) => g.resource_type === 'node_client' && g.resource_id === cid), asset: clientById.get(cid) || { id: cid } })),
    ips: (ipAllocRes.data || []).map((a: any) => ({ allocation: a, asset: ipById.get(a.ip_id) || { id: a.ip_id } })),
  })
}
