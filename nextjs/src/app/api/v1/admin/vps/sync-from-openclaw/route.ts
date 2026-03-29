import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// 从 openclaw vm_instances 同步采集到 vps_instances（幂等）
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
  if (!roleData || !['admin', 'ops'].includes(roleData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createServerAdminClient()

  // 读取 openclaw vm_instances（无 RLS，service_role 可直接读）
  const { data: vmInstances, error: fetchErr } = await adminClient
    .from('vm_instances' as any)
    .select('instance_name, external_ip, zone, account_id, status')

  if (fetchErr) {
    return NextResponse.json({ error: `Failed to read vm_instances: ${fetchErr.message}` }, { status: 500 })
  }

  if (!vmInstances || vmInstances.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // 字段映射并 upsert（ON CONFLICT gcp_instance_name）
  const rows = (vmInstances as any[]).map((vm) => ({
    gcp_instance_name: vm.instance_name,
    public_ip: vm.external_ip,
    zone: vm.zone,
    gcp_project_id: vm.account_id ?? null,
    provider: 'gcp',
    heartbeat_status: 'unknown',
  }))

  const { data, error: upsertErr } = await adminClient
    .from('vps_instances' as any)
    .upsert(rows, { onConflict: 'gcp_instance_name' })
    .select()

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ synced: (data as any[]).length })
}
