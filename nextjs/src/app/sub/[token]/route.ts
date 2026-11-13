// @ts-nocheck
//
// GET /sub/[token] — 订阅内容端点（故意公开 / PUBLIC ON PURPOSE）
//
// 鉴权说明:此端点【不加 session 鉴权】。订阅链接的安全性由 URL 中的
// subscribe_token 本身承担(高熵、唯一索引、无需登录即可被客户端拉取)。
// 这是标准订阅链接语义 —— 任何代理客户端(Clash/v2rayN 等)都无法携带
// console 的登录态,只能匿名 GET 该 URL。
//
// ⚠️ W1 路由鉴权审计器会把本路由标记为“无 session”。这是预期行为,
//    需将 `/sub/[token]` 加入审计器的公开端点 allowlist。(本文件不改审计器,
//    仅在此注释说明设计意图。)
//
// 现实约束:nodes 表当前为空、节点下发流(node_deployments.rendered_config)
// 尚未打通(W6/agent 跨仓库)。因此订阅【内容】暂时无法真实生成 —— 本端点
// 对“无内容”场景做优雅降级:返回 HTTP 200 + 空订阅,绝不报错、绝不造假。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { buildSeatShareLink, isShadowsocksProtocol, isSocksProtocol } from '@/lib/clients/node-client-admin'
import { loadSeatLinkNode } from '@/lib/clients/seat-link-context'
import { subscriptionResponse } from '@/lib/subscription/clientResponse'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const admin = await createServerAdminClient()

  // 1) token 鉴权:按 subscribe_token 精确匹配 node
  const { data: node, error: nodeErr } = await admin
    .from('nodes')
    .select('id, status')
    .eq('subscribe_token', token)
    .maybeSingle()

  if (nodeErr || !node) {
    // token 无效 → 404(不泄露 token 是否曾存在)
    return new NextResponse('Not Found', { status: 404 })
  }

  // 2) 节点链接上下文:协议 / 公网地址 / 端口 / SS method / vless base 链接(最新带 rendered_config 的部署)
  const linkNode = await loadSeatLinkNode(admin, node.id)
  const base = linkNode?.base_link ?? null
  const isSs = isShadowsocksProtocol(linkNode?.protocol)
  const isSocks = isSocksProtocol(linkNode?.protocol) // R-012:socks 席位同 SS,由节点字段 + 凭据拼链接,无需 base

  // 3) 节点级订阅 = 该 node 全部启用终端(seat)的合集(vless 换自己的 uuid、复用节点 reality 参数;SS 拼 SIP002)。
  //    含所有 user 用户 → 一个节点订阅地址导入即得该节点下全部名额。见 docs/current/51 §11.4。
  if (base || isSs || isSocks) {
    const { data: clients } = await admin
      .from('node_clients')
      .select('email, cred_ref, label, enabled')
      .eq('node_id', node.id)
      .eq('enabled', true)
      .order('created_at', { ascending: true })

    const links: string[] = []
    for (const c of (clients ?? []) as any[]) {
      const link = buildSeatShareLink(linkNode, { cred_ref: c.cred_ref, label: c.label, email: c.email })
      if (link) links.push(link)
    }
    // 无终端时退化为节点自身 base 链接(匿名),使订阅不为空(SS 无 base,则走下方降级)
    if (links.length === 0 && base) links.push(base)

    // SDD 61:Clash 类客户端 → sublink-worker 转 clash yaml;其它 → base64。失败回落 base64。
    if (links.length > 0) return subscriptionResponse(request, links)
  }

  // 4) base link 取不到 → 回退到 rendered_config 原始订阅正文(保守提取)。
  const { data: deployment } = await admin
    .from('node_deployments')
    .select('rendered_config, status, created_at')
    .eq('node_id', node.id)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const subscriptionBody = extractSubscription(deployment?.rendered_config)

  if (subscriptionBody != null && subscriptionBody.length > 0) {
    return new NextResponse(subscriptionBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  // 4) 优雅降级:节点存在但订阅内容尚未下发 → HTTP 200 空订阅。
  //    客户端会得到一个空订阅(不报错),等下发流打通后自动有内容。
  return new NextResponse(
    '# 节点待下发(subscription pending): 该订阅 token 有效,但配置尚未渲染下发。\n',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  )
}

// 从 rendered_config(jsonb)保守提取订阅正文;取不到返回 null(不造假)。
function extractSubscription(rendered: unknown): string | null {
  if (rendered == null) return null
  if (typeof rendered === 'string') return rendered
  if (typeof rendered === 'object') {
    const obj = rendered as Record<string, unknown>
    const candidate = obj.subscription ?? obj.content ?? obj.share_links
    if (typeof candidate === 'string') return candidate
    if (Array.isArray(candidate)) {
      const lines = candidate.filter((x) => typeof x === 'string') as string[]
      if (lines.length > 0) return lines.join('\n')
    }
  }
  return null
}
