import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. 鉴权
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 角色校验
  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. 写入
  const adminClient = await createServerAdminClient()
  const body = await request.json()

  const { data, error } = await adminClient
    .from('vps_instances' as any)
    .insert({
      gcp_instance_name: body.gcp_instance_name,
      public_ip: body.public_ip,
      zone: body.zone,
      provider: body.provider ?? 'gcp',
      gcp_project_id: body.gcp_project_id ?? null,
      heartbeat_status: 'unknown',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
