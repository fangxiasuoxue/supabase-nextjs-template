import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// 分域授权(把域名指派给用户)。仅 admin。SDD 54 P4 —— mirror /api/v1/admin/assign(节点级)。
// 归属真相 = domain_grants(资源键=域名文本;access_grants.resource_id 是 uuid,存不了域名,故专表)。
// 授权本身不改数据面;作用域生效由域名页面(总览过滤 / 详情门)承担。

async function requireAdmin(): Promise<{ user: any } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  if (!role || (role as any).role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden(仅 admin 可授权)' }, { status: 403 }) }
  }
  return { user }
}

// GET /api/v1/admin/domain-assign?domain=<域名> — 列该域名的被授权用户(含 email)。
export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domain) return NextResponse.json({ error: 'missing domain' }, { status: 400 })

  const admin = await createServerAdminClient()
  const { data: rows, error } = await (admin as any)
    .from('domain_grants')
    .select('id, user_id, granted_by, created_at')
    .eq('domain', domain)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: userList } = await admin.auth.admin.listUsers({})
  const emailById = new Map((userList?.users || []).map((u: any) => [u.id, u.email]))
  const assignments = (rows || []).map((r: any) => ({ ...r, email: emailById.get(r.user_id) ?? null }))
  return NextResponse.json({ assignments })
}

// POST /api/v1/admin/domain-assign — body { domain, user_id } → 授权(幂等)。
export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const { domain, user_id } = body
  if (!domain || !user_id) return NextResponse.json({ error: '缺 domain/user_id' }, { status: 400 })

  const admin = await createServerAdminClient()
  const { data: existing } = await (admin as any)
    .from('domain_grants')
    .select('id')
    .eq('domain', domain)
    .eq('user_id', user_id)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, id: (existing as any).id, idempotent: true })

  const { data, error } = await (admin as any)
    .from('domain_grants')
    .insert({ domain, user_id, granted_by: gate.user.id } as any)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as any)?.id }, { status: 201 })
}

// DELETE /api/v1/admin/domain-assign?domain=&user_id= — 撤销授权。
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const sp = req.nextUrl.searchParams
  const domain = sp.get('domain') ?? ''
  const user_id = sp.get('user_id') ?? ''
  if (!domain || !user_id) return NextResponse.json({ error: 'bad params' }, { status: 400 })

  const admin = await createServerAdminClient()
  const { error } = await (admin as any)
    .from('domain_grants')
    .delete()
    .eq('domain', domain)
    .eq('user_id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
