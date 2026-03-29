import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// POST /api/v1/admin/vps/[id]/issue-token — 颁发 agent_token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || !['admin'].includes(roleData.role)) {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  const { id } = await params
  const adminClient = await createServerAdminClient()

  // 先作废旧 token
  await adminClient
    .from('agent_tokens' as any)
    .update({ status: 'revoked' })
    .eq('instance_id', id)
    .eq('status', 'active')

  // 生成新 token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const { data, error } = await adminClient
    .from('agent_tokens' as any)
    .insert({
      instance_id: id,
      token_hash: tokenHash,
      status: 'active',
      issued_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 明文 token 只在此次响应返回，之后不可再查
  return NextResponse.json({ token: rawToken, id: (data as any).id }, { status: 201 })
}
