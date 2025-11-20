import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const body = await req.json()
  const ip_id = body?.ip_id as number
  const ids = body?.assignee_user_ids as string[]
  const notes = body?.notes as string | undefined
  if (!ip_id || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const ssr = await createSSRClient()
  const { data: auth } = await ssr.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  const { data: role } = await ssr.from('user_roles' as any).select('role').eq('user_id', uid).limit(1).maybeSingle()
  const isAdmin = role?.role === 'admin'
  const { data: perm } = await ssr.from('module_permissions' as any).select('can_write, can_manage').eq('user_id', uid).eq('module', 'ip').limit(1).maybeSingle()
  const canWrite = isAdmin || !!perm?.can_write || !!perm?.can_manage
  if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = ids.map((assignee) => ({
    ip_id,
    assigned_to: null,
    state: 'allocated',
    allocated_at: new Date().toISOString(),
    notes: notes ?? null,
    owner: uid,
    assignee_user_id: assignee,
  }))
  const { error } = await ssr.from('ip_allocations' as any).insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: rows.length })
}