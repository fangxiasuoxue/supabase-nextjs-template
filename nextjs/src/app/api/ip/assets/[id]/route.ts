import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

async function requireIpManage() {
  const ssr = await createSSRClient()
  const { data: auth } = await ssr.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { uid: null, error: NextResponse.json({ error: 'Not logged in' }, { status: 401 }) }

  const { data: role } = await ssr.from('user_roles').select('role').eq('user_id', uid).limit(1).maybeSingle()
  const isPrivileged = ['admin', 'ops'].includes(String((role as any)?.role || ''))
  const { data: perm } = await ssr.from('module_permissions').select('can_manage').eq('user_id', uid).eq('module', 'ip').limit(1).maybeSingle()
  const canManage = isPrivileged || !!(perm as any)?.can_manage
  if (!canManage) return { uid, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { uid, error: null }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireIpManage()
  if (gate.error) return gate.error

  const { id } = await params
  const ipId = Number(id)
  if (!ipId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (typeof body?.terminate_at_period_end === 'boolean') {
    updates.terminate_at_period_end = body.terminate_at_period_end
  }
  if (typeof body?.usage_context === 'string' || body?.usage_context === null) {
    updates.usage_context = body.usage_context ? String(body.usage_context).trim() : null
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No allowed fields' }, { status: 400 })

  const admin = await createServerAdminClient()
  const { error } = await (admin as any).from('ip_assets').update(updates).eq('id', ipId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireIpManage()
  if (gate.error) return gate.error

  const { id } = await params
  const ipId = Number(id)
  if (!ipId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const admin = await createServerAdminClient()
  const now = new Date().toISOString()
  const { error } = await (admin as any)
    .from('ip_assets')
    .update({ deleted_at: now })
    .eq('id', ipId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
