import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/transit/api-helpers'
import { syncTunnel } from '@/lib/transit/orchestrator'

// POST —— 建/对账 GoRelay 隧道,回读 gorelay_tunnel_id 落库
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  try {
    const res = await syncTunnel(id)
    return NextResponse.json({ data: res }, { status: 202 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
