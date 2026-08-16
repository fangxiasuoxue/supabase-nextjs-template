// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/ip/latency-matrix — 读 IP 测速矩阵(源节点 × IP 的最新时延)
// 需求 #3 + 迭代:前端行=IP(名称+IP)、列=源节点,格=最新时延。
//   本路由:① 关联 ip_assets 带上规范名称 label;② 过滤掉已失效(过期/软删)的 IP,只留有效资产。
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

  // 1. 有效资产集合:未软删 + 未过期(expires_at 为空或未来)。构建 ip→label 映射与白名单。
  const nowIso = new Date().toISOString()
  const { data: assets, error: assetErr } = await adminClient
    .from('ip_assets')
    .select('ip, label, provider_id, expires_at, status, deleted_at')
    .is('deleted_at', null)
  if (assetErr) {
    return NextResponse.json({ data: [], note: assetErr.message }, { status: 200 })
  }
  const labelByIp = new Map<string, string>()
  const validIps = new Set<string>()
  for (const a of (assets as any[]) ?? []) {
    if (!a.ip) continue
    const notExpired = !a.expires_at || a.expires_at > nowIso
    if (!notExpired) continue
    validIps.add(a.ip)
    const lbl = a.label || (a.provider_id ? `#${a.provider_id}` : a.ip)
    labelByIp.set(a.ip, lbl)
  }

  // 2. 矩阵原始行(按 tested_at desc,前端取每格最新)
  const { data, error } = await adminClient
    .from('ip_latency_matrix' as any)
    .select('ip, source_node, latency_ms, tested_at')
    .order('tested_at', { ascending: false })

  if (error) {
    // 表未建(migration 未执行)时不 500,返回空矩阵(前端优雅提示)
    return NextResponse.json({ data: [], note: error.message }, { status: 200 })
  }

  // 3. 只保留有效 IP 的格,并附上 label
  const rows = ((data as any[]) ?? [])
    .filter((r) => r?.ip && validIps.has(r.ip))
    .map((r) => ({ ...r, label: labelByIp.get(r.ip) ?? r.ip }))

  return NextResponse.json({ data: rows })
}
