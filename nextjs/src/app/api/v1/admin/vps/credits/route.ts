// @ts-nocheck
import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// GET /api/v1/admin/vps/credits — 各 GCP 账号最新赠金余额(来自 billing_snapshots,
// 由 ops/monitoring gcp_credit 每日抓 GCP 账单页落库)。flextra=google-01 为主账号(香港项目钱包)。
export async function GET() {
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: roleData } = await authClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createServerAdminClient()
  // 取有赠金的快照(按日期倒序),JS 里每账号取最新一条
  const { data: snaps, error } = await admin
    .from('billing_snapshots')
    .select('account_id, snapshot_date, credit_balance, credit_total, has_credit, success, source')
    .not('credit_balance', 'is', null)
    .order('snapshot_date', { ascending: false })
  if (error) return NextResponse.json({ data: [], note: error.message }, { status: 200 })

  const latest: Record<string, any> = {}
  for (const s of (snaps as any[]) ?? []) {
    if (!latest[s.account_id]) latest[s.account_id] = s
  }

  // 关联 gcp_accounts 拿 gmail/label
  const { data: accts } = await admin
    .from('gcp_accounts').select('id, gmail_email, label, project_id')
  const acctMap: Record<string, any> = {}
  for (const a of (accts as any[]) ?? []) acctMap[a.id] = a

  const rows = Object.values(latest).map((s: any) => {
    const bal = Number(s.credit_balance)
    const tot = s.credit_total != null ? Number(s.credit_total) : null
    return {
      account_id: s.account_id,
      gmail: acctMap[s.account_id]?.gmail_email ?? null,
      label: acctMap[s.account_id]?.label ?? null,
      project_id: acctMap[s.account_id]?.project_id ?? null,
      credit_balance: bal,
      credit_total: tot,
      pct: tot ? Math.round((bal / tot) * 100) : null,
      snapshot_date: s.snapshot_date,
      source: s.source,
    }
  })
  // flextra(google-01)排最前
  rows.sort((a, b) => (a.account_id === 'google-01' ? -1 : b.account_id === 'google-01' ? 1 : a.account_id.localeCompare(b.account_id)))

  return NextResponse.json({ data: rows })
}
