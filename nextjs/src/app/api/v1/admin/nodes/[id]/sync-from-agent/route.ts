import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { callAgent } from '@/lib/agent/client'

// POST /api/v1/admin/nodes/[id]/sync-from-agent — 从 agent 同步节点实际状态
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const adminClient = await createServerAdminClient()

  // 查 node 对应的 vps_id
  const { data: node, error: nodeErr } = await adminClient
    .from('nodes' as any)
    .select('id, vps_id, inbound_tag')
    .eq('id', id)
    .single()

  if (nodeErr || !node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }

  try {
    const agentResp = await callAgent((node as any).vps_id, '/panel/inbounds', { method: 'GET' })
    if (!agentResp.ok) {
      return NextResponse.json({ error: `Agent returned ${agentResp.status}` }, { status: 502 })
    }
    const inbounds = await agentResp.json()

    // 找到 inbound_tag 匹配的 inbound
    const matched = Array.isArray(inbounds)
      ? inbounds.find((ib: any) => ib.tag === (node as any).inbound_tag)
      : null

    if (!matched) {
      return NextResponse.json({ error: 'Inbound tag not found on agent' }, { status: 404 })
    }

    // 更新 nodes 状态
    const { error: updateErr } = await adminClient
      .from('nodes' as any)
      .update({ status: 'active', last_synced_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ synced: true, inbound: matched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
