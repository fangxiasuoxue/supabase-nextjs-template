import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth/resourceAccess'

// 资源授权(把 node / node_client 指派给用户)。归属真相 = access_grants。
// 设计依据:docs/current/55 §5 D3(子授权)。授权本身不改数据面;作用域由各 admin 路由 scope 判定承担。
//
// SDD 55 · P4/D3 —— 授权权限按 resource_type 分级(不再一刀切 admin-only):
//   · node / vps 级授权(转授管理权/部署权)→ 仅 admin(代理不能把管理权再转给别人)。
//   · node_client 级(把某终端订阅子授权给端用户)→ admin ∨ 对该 seat 所属 node 有 write+ 的
//     管理者(真·二级代理:自己给客户发订阅,不必每次找 admin)。granted_by 记录实际授权人(审计)。
const RESOURCE_TYPES = new Set(['node', 'node_client'])

// 按 resource_type 的授权权限门(D3):
//   admin → 放行一切;否则仅 node_client 且对其父 node 有 write+(hasResourceAccess 含 admin/ops 旁路)。
async function requireAssignAuthority(
  resourceType: string,
  resourceId: string,
): Promise<{ user: any } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  if ((role as any)?.role === 'admin') return { user }

  // 非 admin:仅 node_client 子授权可放开,且须对该 seat 所属 node 有 write+。
  if (resourceType === 'node_client') {
    const admin = await createServerAdminClient()
    const { data: seat } = await (admin as any)
      .from('node_clients').select('node_id').eq('id', resourceId).maybeSingle()
    const nodeId = (seat as { node_id?: string } | null)?.node_id
    if (nodeId && (await hasResourceAccess(user.id, 'node', nodeId, 'write'))) return { user }
    return { error: NextResponse.json({ error: 'Forbidden(需对该终端所属节点有 write 权限)' }, { status: 403 }) }
  }
  return { error: NextResponse.json({ error: 'Forbidden(node/vps 级授权仅 admin)' }, { status: 403 }) }
}

// GET /api/v1/admin/assign?resource_type=node&resource_id=<id> — 列该资源的被授权用户(含 email)。
export async function GET(req: NextRequest) {
  const resourceType = req.nextUrl.searchParams.get('resource_type') ?? ''
  const resourceId = req.nextUrl.searchParams.get('resource_id') ?? ''
  if (!RESOURCE_TYPES.has(resourceType) || !resourceId) {
    return NextResponse.json({ error: 'bad resource_type/resource_id' }, { status: 400 })
  }
  const gate = await requireAssignAuthority(resourceType, resourceId)
  if ('error' in gate) return gate.error
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
  const body = await req.json().catch(() => ({}))
  const { resource_type, resource_id, user_id: rawUserId, user_email, level: rawLevel } = body
  // D3:admin 走 user_id(下拉);二级代理无用户目录(PII 边界),按 user_email 授权,服务端解析。
  if (!RESOURCE_TYPES.has(resource_type) || !resource_id || (!rawUserId && !user_email)) {
    return NextResponse.json({ error: '缺 resource_type/resource_id/user_id|user_email' }, { status: 400 })
  }
  const gate = await requireAssignAuthority(resource_type, resource_id)
  if ('error' in gate) return gate.error
  // level 归一:node_client 恒 read;node 取合法传入值,否则默认 read。
  const level = resource_type === 'node_client'
    ? 'read'
    : (LEVELS.has(rawLevel) ? rawLevel : 'read')

  const admin = await createServerAdminClient()

  // user_email → user_id 解析(仅精确匹配;不回列目录,避免枚举放大)。找不到 → 404。
  let user_id = rawUserId as string | undefined
  if (!user_id && user_email) {
    const wanted = String(user_email).trim().toLowerCase()
    const { data: list } = await admin.auth.admin.listUsers({})
    const hit = (list?.users || []).find((u: any) => (u.email || '').toLowerCase() === wanted)
    if (!hit) {
      return NextResponse.json({ error: `该邮箱无账号(${wanted});请对方先注册再授权` }, { status: 404 })
    }
    user_id = hit.id
  }
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
  const sp = req.nextUrl.searchParams
  const resource_type = sp.get('resource_type') ?? ''
  const resource_id = sp.get('resource_id') ?? ''
  const user_id = sp.get('user_id') ?? ''
  if (!RESOURCE_TYPES.has(resource_type) || !resource_id || !user_id) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 })
  }
  const gate = await requireAssignAuthority(resource_type, resource_id)
  if ('error' in gate) return gate.error
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
