// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// POST /api/v1/admin/nodes/deploy — 创建节点部署任务
export async function POST(request: NextRequest) {
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

  const adminClient = await createServerAdminClient()
  const body = await request.json()
  const { vps_id, profile_id, deploy_mode } = body

  if (!vps_id || !profile_id) {
    return NextResponse.json({ error: 'vps_id and profile_id are required' }, { status: 400 })
  }

  // 写入 node_deployments
  const { data, error } = await adminClient
    .from('node_deployments' as any)
    .insert({
      vps_id,
      profile_id,
      deploy_mode: deploy_mode ?? 'auto',
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
