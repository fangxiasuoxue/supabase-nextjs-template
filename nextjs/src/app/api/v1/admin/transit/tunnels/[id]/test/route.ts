import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { requireAdmin } from '@/lib/transit/api-helpers'
import { testTunnel } from '@/lib/transit/gorelay'

// GET —— GoRelay /tunnel/{id}/test 两段时延(本地→入口 / 出口→落地)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const { id } = await ctx.params
  const admin = await createServerAdminClient()
  const { data: t } = await (admin as any)
    .from('transit_tunnel')
    .select('gorelay_tunnel_id')
    .eq('id', id)
    .maybeSingle()
  const gid = (t as any)?.gorelay_tunnel_id
  if (!gid) return NextResponse.json({ error: '隧道未同步到 GoRelay(gorelay_tunnel_id 为空)' }, { status: 409 })
  try {
    return NextResponse.json({ data: await testTunnel(gid) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 502 })
  }
}
