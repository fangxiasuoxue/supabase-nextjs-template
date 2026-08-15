// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/ip/latency-matrix — 读 IP 测速矩阵(源节点 × IP 的最新时延)
// 需求 #3:前端渲染 行=IP、列=源节点(hk/us1-7/openwrt/gorelay)、格=最新时延。
export async function GET(_request: NextRequest) {
  // 鉴权:登录 + admin/ops(与 IP 其它 admin 路由一致)
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: roleData } = await authClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createServerAdminClient()
  const { data, error } = await adminClient
    .from('ip_latency_matrix' as any)
    .select('ip, source_node, latency_ms, tested_at')
    .order('tested_at', { ascending: false })

  if (error) {
    // 表未建(migration 未执行)时不 500,返回空矩阵(前端优雅提示)
    return NextResponse.json({ data: [], note: error.message }, { status: 200 })
  }
  return NextResponse.json({ data: data ?? [] })
}
