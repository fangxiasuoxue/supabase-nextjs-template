import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/ip/test-results — 测试结果列表
export async function GET(request: NextRequest) {
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
  if (!roleData || !['admin', 'ops'].includes(roleData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createServerAdminClient()
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)
  const method = searchParams.get('method') // 'vercel' | 'agent' | null

  let query = adminClient
    .from('proxy_test_results' as any)
    .select('*', { count: 'exact' })
    .order('tested_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (method) {
    query = query.eq('test_method', method)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}
