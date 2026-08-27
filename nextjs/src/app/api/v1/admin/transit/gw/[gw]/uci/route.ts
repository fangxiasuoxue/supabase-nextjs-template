import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/transit/api-helpers'
import { generateGwUci } from '@/lib/transit/orchestrator'

// GET —— 生成该 gw 的 passwall2 uci 脚本(gw 无 jiedian-agent,供外部 ssh 执行)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ gw: string }> }) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const { gw } = await ctx.params
  try {
    const script = await generateGwUci(gw)
    return new NextResponse(script, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
