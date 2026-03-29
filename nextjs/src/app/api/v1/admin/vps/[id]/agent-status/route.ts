// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { callAgent } from '@/lib/agent/client'

// GET /api/v1/admin/vps/[id]/agent-status
export async function GET(
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
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const agentResp = await callAgent(id, '/agent/status', { method: 'GET' })
    if (!agentResp.ok) {
      return NextResponse.json(
        { error: `Agent returned ${agentResp.status}` },
        { status: 502 }
      )
    }
    const agentData = await agentResp.json()
    return NextResponse.json(agentData)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
