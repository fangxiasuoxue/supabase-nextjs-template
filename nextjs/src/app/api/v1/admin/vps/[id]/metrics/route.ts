// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/vps/[id]/metrics?hours=24
// 读时序表 vps_metrics(禁用 RLS,只能 service_role 读)→ 必须经此路由
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 鉴权(照抄兄弟路由 agent-status)
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 角色校验 admin/ops
  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // 3. 可选时间窗过滤 ?hours=24
  const hoursParam = request.nextUrl.searchParams.get('hours')
  const hours = hoursParam ? Number(hoursParam) : null

  try {
    const adminClient = await createServerAdminClient()

    let query = adminClient
      .from('vps_metrics')
      .select('instance_id, recorded_at, cpu_percent, mem_percent, disk_percent')
      .eq('instance_id', id)
      .order('recorded_at', { ascending: true })
      .limit(500)

    if (hours && Number.isFinite(hours) && hours > 0) {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
      query = query.gte('recorded_at', since)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
