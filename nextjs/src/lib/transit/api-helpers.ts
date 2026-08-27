import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

/** 仅 admin/ops(承 domain-assign 模式:createSSRClient 登录态 + user_roles) */
export async function requireAdmin(): Promise<{ user: any } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  const r = (role as any)?.role
  if (r !== 'admin' && r !== 'ops') {
    return { error: NextResponse.json({ error: 'Forbidden(仅 admin/ops)' }, { status: 403 }) }
  }
  return { user }
}

/** 通用集合路由 GET(列表,支持 ?col=val eq 过滤)+ POST(建) */
export function crudCollection(table: string, order = 'created_at') {
  return {
    async GET(req: NextRequest) {
      const gate = await requireAdmin()
      if ('error' in gate) return gate.error
      const admin = await createServerAdminClient()
      let q = (admin as any).from(table).select('*').order(order, { ascending: false })
      req.nextUrl.searchParams.forEach((v, k) => {
        if (k !== 'order' && k !== 'limit') q = q.eq(k, v)
      })
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    },
    async POST(req: NextRequest) {
      const gate = await requireAdmin()
      if ('error' in gate) return gate.error
      const body = await req.json().catch(() => ({}))
      const admin = await createServerAdminClient()
      const { data, error } = await (admin as any).from(table).insert(body).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data }, { status: 201 })
    },
  }
}

/** 通用单项路由 GET/PATCH/DELETE(by id) */
export function crudItem(table: string) {
  return {
    async GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const gate = await requireAdmin()
      if ('error' in gate) return gate.error
      const { id } = await ctx.params
      const admin = await createServerAdminClient()
      const { data, error } = await (admin as any).from(table).select('*').eq('id', id).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
      return NextResponse.json({ data })
    },
    async PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const gate = await requireAdmin()
      if ('error' in gate) return gate.error
      const { id } = await ctx.params
      const body = await req.json().catch(() => ({}))
      const admin = await createServerAdminClient()
      const { data, error } = await (admin as any).from(table).update(body).eq('id', id).select('*').maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    },
    async DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const gate = await requireAdmin()
      if ('error' in gate) return gate.error
      const { id } = await ctx.params
      const admin = await createServerAdminClient()
      const { error } = await (admin as any).from(table).delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { deleted: id } })
    },
  }
}
