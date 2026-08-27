import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/transit/api-helpers'
import { reconcileTunnels } from '@/lib/transit/orchestrator'

// GET —— 对账:现网 GoRelay /tunnel vs DB transit_tunnel(缺失/孤儿),对账>记忆
export async function GET(_req: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  try {
    return NextResponse.json({ data: await reconcileTunnels() })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 502 })
  }
}
