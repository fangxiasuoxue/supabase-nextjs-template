import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// 资源授权(把 node / node_client 指派给用户)。仅 admin。
// 设计依据:docs/current/53-node-rbac-reseller-sdd.md。归属真相 = access_grants。
// 授权本身不改数据面;作用域生效由各 admin 路由的 scope 判定承担(增量2)。

const RESOURCE_TYPES = new Set(['node', 'node_client'])

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

// GET /api/v1/admin/assign?resource_type=node&resource_id=<id> — 列该资源的被授权用户(含 email)。
export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const resourceType = req.nextUrl.searchParams.get('resource_type') ?? ''
  const resourceId = req.nextUrl.searchParams.get('resource_id') ?? ''
  if (!RESOURCE_TYPES.has(resourceType) || !resourceId) {
    return NextResponse.json({ error: 'bad resource_type/resource_id' }, { status: 400 })
  }
  const admin = await createServerAdminClient()
  const { data: rows, error } = await (admin as any)
    .from('access_grants')
    .select('id, user_id, granted_by, created_at, level')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 补 email(listUsers 一次,内存匹配)
  const { data: userList } = await admin.auth.admin.listUsers({})
  const emailById = new Map((userList?.users || []).map((u: any) => [u.id, u.email]))
  const assignments = (rows || []).map((r: any) => ({ ...r, email: emailById.get(r.user_id) ?? null }))
  return NextResponse.json({ assignments })
}

// POST /api/v1/admin/assign — body { resource_type, resource_id, user_id, level? } → 授权。
// SDD 55:level ∈ {read,write,manage};node_client 恒 'read'(端用户只读自己订阅);
//         node 默认 'read',由 UI 显式选 write/manage。已存在则**更新为最新 level**(E12)。
const LEVELS = new Set(['read', 'write', 'manage'])
export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const { resource_type, resource_id, user_id, level: rawLevel } = body
  if (!RESOURCE_TYPES.has(resource_type) || !resource_id || !user_id) {
    return NextResponse.json({ error: '缺 resource_type/resource_id/user_id' }, { status: 400 })
  }
  // level 归一:node_client 恒 read;node 取合法传入值,否则默认 read。
  const level = resource_type === 'node_client'
    ? 'read'
    : (LEVELS.has(rawLevel) ? rawLevel : 'read')

  const admin = await createServerAdminClient()
  // 已存在 → 更新 level(允许改级/降级,覆盖为最新);否则插入。
  const { data: existing } = await (admin as any)
    .from('access_grants')
    .select('id, level')
    .eq('resource_type', resource_type)
    .eq('resource_id', resource_id)
    .eq('user_id', user_id)
    .maybeSingle()
  if (existing) {
    if ((existing as any).level !== level) {
      const { error: upErr } = await (admin as any)
        .from('access_grants').update({ level } as any).eq('id', (existing as any).id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: (existing as any).id, level, updated: true })
  }

  const { data, error } = await (admin as any)
    .from('access_grants')
    .insert({ resource_type, resource_id, user_id, level, granted_by: gate.user.id } as any)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as any)?.id, level }, { status: 201 })
}

// DELETE /api/v1/admin/assign?resource_type=&resource_id=&user_id= — 撤销授权。
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const sp = req.nextUrl.searchParams
  const resource_type = sp.get('resource_type') ?? ''
  const resource_id = sp.get('resource_id') ?? ''
  const user_id = sp.get('user_id') ?? ''
  if (!RESOURCE_TYPES.has(resource_type) || !resource_id || !user_id) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 })
  }
  const admin = await createServerAdminClient()
  const { error } = await (admin as any)
    .from('access_grants')
    .delete()
    .eq('resource_type', resource_type)
    .eq('resource_id', resource_id)
    .eq('user_id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
