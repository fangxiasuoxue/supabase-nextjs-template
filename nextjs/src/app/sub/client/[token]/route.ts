// GET /sub/client/[token] — 每终端(seat)订阅端点(故意公开 / PUBLIC ON PURPOSE)
//
// 鉴权由高熵 subscribe_token 承担(同 /sub/[token] 语义,代理客户端无法带登录态)。
// ⚠️ 路由鉴权审计器需把 /sub/client/[token] 加入公开端点 allowlist。
//
// 内容来源:node 最新 rendered_config 里的"基础 share link" → 换成本终端自己的 uuid(cred_ref)。
// 这样每终端复用节点 reality 参数(pbk/sid/sni),只换自己的 uuid。见 docs/current/51 §11.4。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { swapVlessUuid, extractBaseShareLink } from '@/lib/clients/node-client-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return new NextResponse('Not Found', { status: 404 })

  const admin = await createServerAdminClient()

  // 1) token → 终端
  const { data: client } = await admin
    .from('node_clients')
    .select('id, node_id, email, cred_ref, label, enabled')
    .eq('subscribe_token', token)
    .maybeSingle()
  if (!client) return new NextResponse('Not Found', { status: 404 })

  // 2) 取该 node 最新带 rendered_config 的部署(基础 share link 来源)
  const { data: deployment } = await admin
    .from('node_deployments')
    .select('rendered_config, created_at')
    .eq('node_id', (client as any).node_id)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const base = extractBaseShareLink(deployment?.rendered_config)
  if (!base) {
    // 优雅降级:节点订阅内容尚未就绪 → 返回空订阅(200,不报错、不造假)
    return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // 3) 换成本终端 uuid,remark 用 label 或 email
  let link: string
  try {
    const remark = (client as any).label || (client as any).email
    link = swapVlessUuid(base, (client as any).cred_ref, remark)
  } catch {
    return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // 4) 标准订阅格式 = base64(链接换行拼接)
  const subscription = Buffer.from(link, 'utf-8').toString('base64')
  return new NextResponse(subscription, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
