import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { rollupAccess, type AccessStatRow } from '@/lib/traffic/access-rollup'

// P3 · 节点访问画像:Top域名 / 终端画像 / 分流体检(读 node_access_stat 聚合)。
// 设计依据:docs/current/51 §4.1。权限门 admin/ops。只读。

async function requireOps(): Promise<{ user: any } | { error: NextResponse }> {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  if (!role || !['admin', 'ops'].includes((role as any).role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

const WINDOWS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

// GET /api/v1/admin/nodes/[id]/access?window=24h|7d|30d(默认 7d)&email=<终端>
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOps()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params

  const windowKey = req.nextUrl.searchParams.get('window') ?? '7d'
  const emailFilter = req.nextUrl.searchParams.get('email')
  const hours = WINDOWS[windowKey] ?? WINDOWS['7d']
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  const admin = await createServerAdminClient()
  let q = admin
    .from('node_access_stat' as any)
    .select('email, domain, outbound_tag, hits, uniq_clients')
    .eq('node_id', id)
    .gte('bucket_hour', sinceIso)
    .limit(100000)
  if (emailFilter) q = q.eq('email', emailFilter)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rollup = rollupAccess((data ?? []) as unknown as AccessStatRow[])
  return NextResponse.json({ window: windowKey, since: sinceIso, ...rollup })
}
