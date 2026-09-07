import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, requireNodeAccess } from '@/lib/auth/resourceAccess'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const nodeId = req.nextUrl.searchParams.get('node_id') || ''
  const moduleGate = await requireModuleAccess('outbound', 'manage')
  if ('error' in moduleGate) return moduleGate.error
  const nodeGate = await requireNodeAccess(nodeId, 'manage')
  if ('error' in nodeGate) return nodeGate.error

  const admin = await createServerAdminClient()
  const { data: item } = await (admin as any).from('outbound_source_items').select('id,display_name').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })

  const { count, error: countError } = await (admin as any).from('node_outbounds')
    .select('id', { count: 'exact', head: true }).eq('source_item_id', id)
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: `该 Endpoint 已被 ${count} 个 Outbound 引用，请先移除关联 Outbound` }, { status: 409 })
  }

  const { error } = await (admin as any).from('outbound_source_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true, id })
}
