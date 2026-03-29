// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { callAgent } from '@/lib/agent/client'

// POST /api/v1/admin/ip/test-via-agent — 委托指定 VPS 的 agent 测试 IP
export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { ip, port, username, password, vps_id, speed_test = true } = body

  if (!ip || !port || !vps_id) {
    return NextResponse.json({ error: 'ip, port, vps_id are required' }, { status: 400 })
  }

  const adminClient = await createServerAdminClient()

  try {
    const agentResp = await callAgent(vps_id, '/probe/socks5', {
      method: 'POST',
      body: JSON.stringify({
        host: ip,
        port,
        username: username ?? null,
        password: password ?? null,
        test_url: 'https://ip.sb',
        speed_test,
        speed_test_size_mb: 5,
        timeout_ms: 15000,
      }),
    })

    if (!agentResp.ok) {
      return NextResponse.json({ error: `Agent returned ${agentResp.status}` }, { status: 502 })
    }

    const result = await agentResp.json()

    // 写入 proxy_test_results
    const { error: insertErr } = await adminClient
      .from('proxy_test_results' as any)
      .insert({
        ip,
        port,
        success: result.success ?? false,
        latency_ms: result.latency_ms ?? null,
        exit_ip: result.exit_ip ?? null,
        upload_mbps: result.upload_mbps ?? null,
        download_mbps: result.download_mbps ?? null,
        tested_from_vps_id: vps_id,
        tested_from_ip: result.tested_from_ip ?? null,
        test_method: 'agent',
        error_message: result.error ?? null,
      })

    if (insertErr) {
      console.error('proxy_test_results insert error:', insertErr.message)
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
