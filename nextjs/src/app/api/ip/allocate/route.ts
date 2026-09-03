import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

async function requireIpManage() {
  const ssr = await createSSRClient()
  const { data: auth } = await ssr.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { ssr, uid: null, error: NextResponse.json({ error: 'Not logged in' }, { status: 401 }) }
  const { data: role } = await ssr.from('user_roles').select('role').eq('user_id', uid).limit(1).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (role as any)?.role === 'admin'
  const { data: perm } = await ssr.from('module_permissions').select('can_manage').eq('user_id', uid).eq('module', 'ip').limit(1).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canManage = isAdmin || !!(perm as any)?.can_manage
  if (!canManage) return { ssr, uid, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ssr, uid, error: null }
}

export async function POST(req: Request) {
  const body = await req.json()
  const ip_id = body?.ip_id as number
  const ids = body?.assignee_user_ids as string[]
  const notes = body?.notes as string | undefined
  if (!ip_id || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const gate = await requireIpManage()
  if (gate.error) return gate.error
  const { ssr, uid } = gate

  const { data: existing, error: existingError } = await ssr
    .from('ip_allocations')
    .select('assignee_user_id')
    .eq('ip_id', ip_id)
    .eq('state', 'allocated')
    .is('released_at', null)
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  const existingIds = new Set(((existing as any[]) || []).map((r) => r.assignee_user_id).filter(Boolean))
  const rows = ids.filter((assignee) => !existingIds.has(assignee)).map((assignee) => ({
    ip_id,
    assigned_to: null,
    state: 'allocated',
    allocated_at: new Date().toISOString(),
    notes: notes ?? null,
    owner: uid,
    assignee_user_id: assignee,
  }))
  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await ssr.from('ip_allocations').insert(rows as any)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ count: rows.length })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const ipId = Number(url.searchParams.get('ip_id'))
  const userId = url.searchParams.get('user_id')
  if (!ipId || !userId) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const gate = await requireIpManage()
  if (gate.error) return gate.error
  const { ssr } = gate
  const { error } = await ssr
    .from('ip_allocations')
    .update({ state: 'released', released_at: new Date().toISOString() } as any)
    .eq('ip_id', ipId)
    .eq('assignee_user_id', userId)
    .eq('state', 'allocated')
    .is('released_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}