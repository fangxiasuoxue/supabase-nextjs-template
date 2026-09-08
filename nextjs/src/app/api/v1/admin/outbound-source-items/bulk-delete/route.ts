import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, requireNodeAccess } from '@/lib/auth/resourceAccess'
import { assessEndpointBulkDelete } from '@/lib/outbound/catalog'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export async function POST(req: NextRequest) {
  const moduleGate = await requireModuleAccess('outbound', 'manage')
  if ('error' in moduleGate) return moduleGate.error

  const body = await req.json().catch(() => ({})) as { ids?: unknown; node_id?: unknown }
  const nodeId = typeof body.node_id === 'string' ? body.node_id : ''
  const nodeGate = await requireNodeAccess(nodeId, 'manage')
  if ('error' in nodeGate) return nodeGate.error

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))]
    : []
  if (!ids.length || ids.length > 200) {
    return NextResponse.json({ error: '请选择 1–200 个订阅 Endpoint' }, { status: 400 })
  }

  const admin = await createServerAdminClient()
  const { data: items, error: itemError } = await (admin as any).from('outbound_source_items')
    .select('id,source_id').in('id', ids)
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
  if ((items ?? []).length !== ids.length) return NextResponse.json({ error: '部分 Endpoint 不存在，请刷新后重试' }, { status: 409 })

  const sourceIds = [...new Set((items ?? []).map((item: any) => item.source_id))]
  const { data: sources, error: sourceError } = await (admin as any).from('outbound_sources')
    .select('id,kind').in('id', sourceIds)
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if ((sources ?? []).some((source: any) => source.kind !== 'subscription')) {
    return NextResponse.json({ error: '批量清理仅允许订阅源 Endpoint，托管节点和 Cheap IP 不会被删除' }, { status: 400 })
  }

  const { data: refs, error: refError } = await (admin as any).from('node_outbounds')
    .select('id,tag,deploy_state').in('source_item_id', ids)
  if (refError) return NextResponse.json({ error: refError.message }, { status: 500 })
  const refIds = (refs ?? []).map((ref: any) => ref.id)
  let boundIds = new Set<string>()
  if (refIds.length) {
    const { data: clients, error: clientError } = await (admin as any).from('node_clients')
      .select('outbound_id').in('outbound_id', refIds)
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
    boundIds = new Set((clients ?? []).map((client: any) => client.outbound_id).filter(Boolean))
  }

  const assessment = assessEndpointBulkDelete(refs ?? [], boundIds)
  if (assessment.blockers.length) {
    return NextResponse.json({
      error: `存在运行中或已绑定 Client 的出口，批量删除已取消：${assessment.blockers.slice(0, 10).join(', ')}`,
      blockers: assessment.blockers,
    }, { status: 409 })
  }

  if (assessment.deletableOutboundIds.length) {
    const { error } = await (admin as any).from('node_outbounds').delete().in('id', assessment.deletableOutboundIds)
    if (error) return NextResponse.json({ error: `清理未生效 Outbound 失败：${error.message}` }, { status: 500 })
  }
  const { error: deleteError } = await (admin as any).from('outbound_source_items').delete().in('id', ids)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({
    deleted_items: ids.length,
    deleted_draft_outbounds: assessment.deletableOutboundIds.length,
  })
}
