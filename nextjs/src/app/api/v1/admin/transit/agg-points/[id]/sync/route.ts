import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/transit/api-helpers'
import { syncAggPoint } from '@/lib/transit/orchestrator'

// POST —— 幂等下发聚合点 xray(inbound 全用户 + N cheap 出站 + N ruleTag 路由 + persist)
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  try {
    const res = await syncAggPoint(id)
    return NextResponse.json({ data: res }, { status: 202 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
