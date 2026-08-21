import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/users/list — 列出全部用户(id/email)。
// 列举用户是敏感 PII 操作,仅限 admin:先校验登录会话,再校验角色。
export async function GET() {
  // 1) 必须已登录(SSR 会话,anon client 受 RLS)
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2) 必须是 admin
  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || (roleData as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3) 通过校验后才用 service_role 列用户 + 附角色(供授权选择器展示/筛选)
  const admin = await createServerAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({})
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: roles } = await admin.from('user_roles').select('user_id, role')
  const roleById = new Map((roles || []).map((r: any) => [r.user_id, r.role]))
  const users = (data?.users || []).map((u: any) => ({ id: u.id, email: u.email, role: roleById.get(u.id) ?? null }))
  return NextResponse.json({ users })
}
