// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/vps/list-with-billing
// 联合 openclaw 表，返回 VPS 列表 + 账单/流量数据
export async function GET(request: NextRequest) {
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

  const adminClient = await createServerAdminClient()

  // 查询 vps_instances 基础信息
  const { data: vpsList, error: vpsErr } = await adminClient
    .from('vps_instances' as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (vpsErr) {
    return NextResponse.json({ error: vpsErr.message }, { status: 500 })
  }

  if (!vpsList || (vpsList as any[]).length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 批量从 openclaw 表 JOIN 账单/流量数据
  const instanceNames = (vpsList as any[])
    .map((v: any) => v.gcp_instance_name)
    .filter(Boolean)

  const billingMap: Record<string, any> = {}

  if (instanceNames.length > 0) {
    // 查 vm_instances → gcp_accounts + traffic_snapshots
    const { data: vmRows } = await adminClient
      .from('vm_instances' as any)
      .select('instance_name, account_id')
      .in('instance_name', instanceNames)

    if (vmRows && (vmRows as any[]).length > 0) {
      const accountIds = [...new Set((vmRows as any[]).map((r: any) => r.account_id).filter(Boolean))]

      // 账单余额
      const { data: gcpAccounts } = await adminClient
        .from('gcp_accounts' as any)
        .select('id, credit_remaining')
        .in('id', accountIds)

      // 近30天费用（在应用层聚合）
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: billingRows } = await adminClient
        .from('billing_snapshots' as any)
        .select('account_id, amount')
        .in('account_id', accountIds)
        .gte('snapshot_date', thirtyDaysAgo)

      // 最新流量快照（每个 vm_instance 取最近一条）
      const vmInstanceIds = (vmRows as any[]).map((r: any) => r.id).filter(Boolean)
      const { data: trafficRows } = await adminClient
        .from('traffic_snapshots' as any)
        .select('vm_instance_id, egress_bytes, ingress_bytes, snapshot_date')
        .in('vm_instance_id', vmInstanceIds)
        .order('snapshot_date', { ascending: false })

      // 构建账单 map
      const accountMap: Record<string, number> = {}
      if (gcpAccounts) {
        for (const acc of gcpAccounts as any[]) {
          accountMap[acc.id] = acc.credit_remaining
        }
      }

      const cost30dMap: Record<string, number> = {}
      if (billingRows) {
        for (const row of billingRows as any[]) {
          cost30dMap[row.account_id] = (cost30dMap[row.account_id] ?? 0) + (row.amount ?? 0)
        }
      }

      // 每个 vm_instance 只取最新流量
      const latestTrafficMap: Record<string, any> = {}
      if (trafficRows) {
        for (const row of trafficRows as any[]) {
          if (!latestTrafficMap[row.vm_instance_id]) {
            latestTrafficMap[row.vm_instance_id] = row
          }
        }
      }

      for (const vm of vmRows as any[]) {
        billingMap[vm.instance_name] = {
          credit_remaining: accountMap[vm.account_id] ?? null,
          cost_30d: cost30dMap[vm.account_id] ?? null,
          upload_bytes: latestTrafficMap[vm.id]?.egress_bytes ?? null,
          download_bytes: latestTrafficMap[vm.id]?.ingress_bytes ?? null,
          billing_updated_at: latestTrafficMap[vm.id]?.snapshot_date ?? null,
        }
      }
    }
  }

  // 合并结果
  const result = (vpsList as any[]).map((vps: any) => ({
    ...vps,
    billing: billingMap[vps.gcp_instance_name] ?? null,
  }))

  return NextResponse.json({ data: result })
}
