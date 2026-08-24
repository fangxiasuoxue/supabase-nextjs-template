import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { rollupTraffic, type TrafficStatRow } from '@/lib/traffic/traffic-rollup'

// P2e · 节点流量榜:聚合 node_traffic_stat 小时桶 → 节点总量 + 每终端总量(窗口内)。
// 设计依据:docs/current/51 §12.6 · SDD 55 P2b。权限门:对该 node 有 read(admin/ops 旁路)。只读。

const WINDOWS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

// GET /api/v1/admin/nodes/[id]/traffic?window=24h|7d|30d(默认 7d)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireNodeAccess(id, 'read')
  if ('error' in gate) return gate.error

  const windowKey = req.nextUrl.searchParams.get('window') ?? '7d'
  const hours = WINDOWS[windowKey] ?? WINDOWS['7d']
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('node_traffic_stat' as any)
    .select('email, uplink_bytes, downlink_bytes')
    .eq('node_id', id)
    .gte('bucket_hour', sinceIso)
    .limit(50000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rollup = rollupTraffic((data ?? []) as unknown as TrafficStatRow[])
  return NextResponse.json({ window: windowKey, since: sinceIso, ...rollup })
}
