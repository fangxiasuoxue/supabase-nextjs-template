import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireAdmin } from '@/lib/transit/api-helpers'

/** Read-only catalog for the transit overview; secrets/config are deliberately omitted. */
export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const db = await createServerAdminClient()
  const [{ data: outbounds, error }, { data: vps, error: vpsError }] = await Promise.all([
    (db as any).from('node_outbounds').select('id,target_vps_instance_id,display_name,tag,transport_kind,transport_ref,deploy_state,updated_at').order('updated_at', { ascending: false }),
    (db as any).from('vps_instances').select('id,name,gcp_instance_name,provider'),
  ])
  if (error || vpsError) return NextResponse.json({ error: (error || vpsError).message }, { status: 500 })
  const names = new Map((vps ?? []).map((x: any) => [x.id, x.name || x.gcp_instance_name || x.provider || x.id]))
  return NextResponse.json({ data: (outbounds ?? []).map((x: any) => ({ ...x, target_name: names.get(x.target_vps_instance_id) })) })
}
