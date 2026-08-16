// @ts-nocheck
//
// GET /sub/bundle/[token] — 聚合订阅内容端点（故意公开 / PUBLIC ON PURPOSE）
//
// 一个 token 对应「所有 status=active 节点」的分享链接合集(base64),供客户端
// 一次导入全部节点。鉴权说明同 /sub/[token]:不加 session 鉴权,安全性由 URL 中的
// 高熵 bundle token 承担(subscription_bundles.token 唯一索引,匿名 GET)。
//
// token 来源:subscription_bundles 表(见 migration 20260816000004)。
// 内容来源:每个 active 节点最新一条带 rendered_config 的 node_deployments,
//          取其 share_links,汇总去后 buildSubscription 成一个 base64。
// 无内容时优雅降级:HTTP 200 + 空订阅,绝不报错、绝不造假。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { buildSubscription } from '@/lib/parsers/node-share-builder'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const admin = await createServerAdminClient()

  // 1) token 鉴权:按 bundle token 精确匹配
  const { data: bundle, error: bundleErr } = await admin
    .from('subscription_bundles')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (bundleErr || !bundle) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // 2) 所有 active 节点
  const { data: nodes } = await admin
    .from('nodes')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null)

  const nodeIds = (nodes ?? []).map((n: any) => n.id)

  const allLinks: string[] = []

  if (nodeIds.length > 0) {
    // 3) 取这些节点带 rendered_config 的部署快照(按时间倒序),每个 node 取最新一条
    const { data: deployments } = await admin
      .from('node_deployments')
      .select('node_id, rendered_config, created_at')
      .in('node_id', nodeIds)
      .not('rendered_config', 'is', null)
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    for (const d of deployments ?? []) {
      if (seen.has(d.node_id)) continue // 只取每个 node 最新一条
      seen.add(d.node_id)
      const links = extractShareLinks(d.rendered_config)
      for (const l of links) allLinks.push(l)
    }
  }

  // 去重(不同节点理论上链接不同,但兜底去重防意外重复)
  const uniqueLinks = Array.from(new Set(allLinks.filter(Boolean)))

  if (uniqueLinks.length > 0) {
    const body = buildSubscription(uniqueLinks)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  // 4) 优雅降级:bundle 有效但暂无可订阅节点 → HTTP 200 空订阅
  return new NextResponse(
    '# 聚合订阅待就绪(bundle pending): token 有效,但当前无带配置的 active 节点。\n',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  )
}

// 从单个节点的 rendered_config 提取「原始 share 链接数组」(用于重新汇总打包)。
//  - 对象含 share_links:string[] → 直接用
//  - 对象含 subscription:string(base64) → 解码后按行拆
//  - 字符串(可能是 base64 订阅或多行链接)→ 尝试解码/按行拆
function extractShareLinks(rendered: unknown): string[] {
  if (rendered == null) return []

  if (typeof rendered === 'object') {
    const obj = rendered as Record<string, unknown>
    if (Array.isArray(obj.share_links)) {
      return (obj.share_links as unknown[]).filter((x) => typeof x === 'string') as string[]
    }
    if (typeof obj.subscription === 'string') {
      return decodeMaybeBase64(obj.subscription as string)
    }
    if (typeof obj.content === 'string') {
      return decodeMaybeBase64(obj.content as string)
    }
    return []
  }

  if (typeof rendered === 'string') {
    return decodeMaybeBase64(rendered)
  }

  return []
}

// 若是 base64 订阅正文则解码后按行拆;否则按行拆原文。只保留看起来像分享链接的行。
function decodeMaybeBase64(s: string): string[] {
  let text = s
  // 订阅正文通常是 base64;若不含协议前缀,尝试 base64 解码
  if (!/^(vless|vmess|trojan|ss|hysteria2?|tuic):\/\//m.test(s)) {
    try {
      const decoded = Buffer.from(s, 'base64').toString('utf-8')
      if (decoded && /:\/\//.test(decoded)) text = decoded
    } catch {
      /* 保持原文 */
    }
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && /:\/\//.test(l))
}
