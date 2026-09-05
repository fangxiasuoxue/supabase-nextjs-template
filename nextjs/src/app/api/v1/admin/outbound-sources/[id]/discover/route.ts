import { NextRequest, NextResponse } from 'next/server'
import { requireNodeAccess } from '@/lib/auth/resourceAccess'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { describeXraySubscription } from '@/lib/outbound/subscription'
import { fetchSubscriptionSecret, resolveEnvSecretRef } from '@/lib/outbound/subscription-fetch'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const nodeId = String(body.node_id || '')
  const gate = await requireNodeAccess(nodeId, 'manage')
  if ('error' in gate) return gate.error

  const admin = await createServerAdminClient()
  const { data: source } = await (admin as any)
    .from('outbound_sources')
    .select('id,kind,secret_ref,status')
    .eq('id', id)
    .maybeSingle()
  if (!source || source.kind !== 'subscription') {
    return NextResponse.json({ error: 'Subscription source not found' }, { status: 404 })
  }

  try {
    const subscriptionUrl = resolveEnvSecretRef(source.secret_ref)
    const responseBody = await fetchSubscriptionSecret(subscriptionUrl)
    const items = describeXraySubscription(responseBody)
    if (!items.length) {
      throw new Error('订阅没有解析出协议链接；Clash/Sing-box 输入待私有 POST converter 支持')
    }
    const now = new Date().toISOString()
    const rows = items.map((item) => ({
      source_id: source.id,
      external_key: item.external_key,
      display_name: item.display_name.slice(0, 200),
      protocol: item.protocol,
      server_hint: item.server_hint,
      port_hint: item.port_hint,
      secret_ref: `secret_ref://outbound-source/${source.id}/item/${item.external_key}`,
      metadata: {},
      compatibility: item.compatibility,
      status: 'active',
      observed_at: now,
    }))
    const { error } = await (admin as any)
      .from('outbound_source_items')
      .upsert(rows, { onConflict: 'source_id,external_key' })
    if (error) throw new Error(error.message)
    await (admin as any).from('outbound_sources').update({
      status: 'active', last_discovered_at: now, last_error: null,
    }).eq('id', source.id)
    return NextResponse.json({
      discovered: rows.length,
      supported: rows.filter((x) => x.compatibility === 'supported').length,
      unsupported: rows.filter((x) => x.compatibility === 'unsupported').length,
      items: rows.map(({ secret_ref: _secret, ...safe }) => safe),
    })
  } catch (e: any) {
    const message = String(e?.message || '订阅发现失败').slice(0, 500)
    await (admin as any).from('outbound_sources').update({ status: 'error', last_error: message }).eq('id', id)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
