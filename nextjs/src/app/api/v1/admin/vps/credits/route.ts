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
    .select('account_id, snapshot_date, credit_balance, credit_total, cost_30d, raw_cost_text, source')
    .order('snapshot_date', { ascending: false })
  if (error) return NextResponse.json({ data: [], note: error.message }, { status: 200 })

  // 每账号:独立取最新的赠金(credit_balance 非空)与最新的消费(cost_30d 非空),两者可能来自不同快照
  const credit: Record<string, any> = {}
  const cost: Record<string, any> = {}
  const seenAcct = new Set<string>()
  for (const s of (snaps as any[]) ?? []) {
    seenAcct.add(s.account_id)
    if (credit[s.account_id] == null && s.credit_balance != null) credit[s.account_id] = s
    if (cost[s.account_id] == null && s.cost_30d != null) cost[s.account_id] = s
  }

  // 关联 gcp_accounts 拿 gmail/label
  const { data: accts } = await admin
    .from('gcp_accounts').select('id, gmail_email, label, project_id')
  const acctMap: Record<string, any> = {}
  for (const a of (accts as any[]) ?? []) acctMap[a.id] = a

  const rows = [...seenAcct].map((aid: string) => {
    const c = credit[aid]
    const k = cost[aid]
    const bal = c ? Number(c.credit_balance) : null
    const tot = c && c.credit_total != null ? Number(c.credit_total) : null
    return {
      account_id: aid,
      gmail: acctMap[aid]?.gmail_email ?? null,
      label: acctMap[aid]?.label ?? null,
      project_id: acctMap[aid]?.project_id ?? null,
      credit_balance: bal,
      credit_total: tot,
      pct: bal != null && tot ? Math.round((bal / tot) * 100) : null,
      cost_30d: k ? Number(k.cost_30d) : null,
      cost_source: k?.source ?? null,
      snapshot_date: (c || k)?.snapshot_date ?? null,
      source: c?.source ?? k?.source ?? null,
    }
  })
  // flextra(google-01)排最前
  rows.sort((a, b) => (a.account_id === 'google-01' ? -1 : b.account_id === 'google-01' ? 1 : a.account_id.localeCompare(b.account_id)))

  return NextResponse.json({ data: rows })
}
