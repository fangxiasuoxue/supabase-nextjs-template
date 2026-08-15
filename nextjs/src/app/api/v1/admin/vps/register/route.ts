// @ts-nocheck
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

  // gcp_instance_name 是新模型业务键(vps_instances 唯一索引,migration 20260814000001),必填
  if (!body.gcp_instance_name) {
    return NextResponse.json({ error: 'Missing gcp_instance_name' }, { status: 400 })
  }

  // 幂等 upsert:按 gcp_instance_name 命中则更新、否则插入(与 sync-from-openclaw 一致,支持重复注册)。
  // 不写旧 GCP 采集列(instance_id/account/name),那些由 actions/vps.ts 的 GCP 同步路径回填;
  // migration 20260814000001 已放宽这些列 NOT NULL,故此 upsert 不再违反约束。
  const { data, error } = await adminClient
    .from('vps_instances' as any)
    .upsert({
      gcp_instance_name: body.gcp_instance_name,
      public_ip: body.public_ip ?? null,
      zone: body.zone ?? null,
      provider: body.provider ?? 'gcp',
      gcp_project_id: body.gcp_project_id ?? null,
      heartbeat_status: 'unknown',
    }, { onConflict: 'gcp_instance_name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
