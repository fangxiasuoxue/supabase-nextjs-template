import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export async function GET() {
  const admin = await createServerAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({})
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const users = (data?.users || []).map((u: any) => ({ id: u.id, email: u.email }))
  return NextResponse.json({ users })
}