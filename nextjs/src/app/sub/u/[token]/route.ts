// GET /sub/u/[token] — 端用户「我的合订阅」内容端点(故意公开 / PUBLIC ON PURPOSE)
//
// SDD 55 · P4/E6:把某端用户当下被授权(access_grants node_client)的全部 enabled seat
//   合并成一个订阅(base64),客户端导一次含全部。鉴权由高熵 user token 承担(同 /sub/*,
//   代理客户端带不了登录态)。⚠️ 路由鉴权审计器需把 /sub/u/[token] 加入公开端点 allowlist。
//
// 内容:token→user_id(user_sub_tokens)→该 user 被授权的 node_clients(enabled)→
//   每 seat 取其 node 最新 rendered_config 的 base share link,换成本 seat 的 uuid(cred_ref)→ 汇总。
// 动态解析:撤销某 seat 授权后,合订阅下次拉取即自动少一条(不缓存作用域)。无内容优雅降级 200 空。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { swapVlessUuid, extractBaseShareLink } from '@/lib/clients/node-client-admin'
import { subscriptionResponse } from '@/lib/subscription/clientResponse'
import { listGrantedResourceIds } from '@/lib/auth/resourceAccess'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return new NextResponse('Not Found', { status: 404 })

  const admin = await createServerAdminClient()

  // 1) token → user
  const { data: owner } = await (admin as any)
    .from('user_sub_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  const userId = (owner as { user_id?: string } | null)?.user_id
  if (!userId) return new NextResponse('Not Found', { status: 404 })

  const emptyBody = '# 合订阅待就绪:token 有效,但你当前无可用的被授权终端。\n'
  const empty = () => new NextResponse(emptyBody, {
    status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })

  // 2) 该 user 被授权的 seat 集合
  const seatIds = await listGrantedResourceIds(userId, 'node_client', 'read')
  if (seatIds.length === 0) return empty()

  const { data: seats } = await (admin as any)
    .from('node_clients')
    .select('id, node_id, cred_ref, email, label, enabled')
    .in('id', seatIds)
  const liveSeats = (seats ?? []).filter((s: any) => s.enabled && s.node_id && s.cred_ref)
  if (liveSeats.length === 0) return empty()

  // 3) 每 node 取最新 rendered_config(一次查,按 node 去重取首条)
  const nodeIds = Array.from(new Set(liveSeats.map((s: any) => s.node_id)))
  const { data: deployments } = await (admin as any)
    .from('node_deployments')
    .select('node_id, rendered_config, created_at')
    .in('node_id', nodeIds)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
  const baseByNode = new Map<string, string>()
  for (const d of deployments ?? []) {
    if (baseByNode.has(d.node_id)) continue
    const base = extractBaseShareLink(d.rendered_config)
    if (base) baseByNode.set(d.node_id, base)
  }

  // 4) 每 seat 换 uuid,remark 用 label/email;汇总去重
  const links: string[] = []
  for (const s of liveSeats) {
    const base = baseByNode.get(s.node_id)
    if (!base) continue
    try {
      links.push(swapVlessUuid(base, s.cred_ref, s.label || s.email || 'seat'))
    } catch { /* 跳过该 seat,不整体失败 */ }
  }
  const unique = Array.from(new Set(links.filter(Boolean)))
  if (unique.length === 0) return empty()

  // SDD 61:Clash 类客户端 → sublink-worker 转 clash yaml;其它 → base64。失败回落 base64。
  return subscriptionResponse(_req, unique)
}
