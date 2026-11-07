// GET /sub/client/[token] — 每终端(seat)订阅端点(故意公开 / PUBLIC ON PURPOSE)
//
// 鉴权由高熵 subscribe_token 承担(同 /sub/[token] 语义,代理客户端无法带登录态)。
// ⚠️ 路由鉴权审计器需把 /sub/client/[token] 加入公开端点 allowlist。
//
// 内容来源:按节点协议——vless:node 最新 rendered_config 的"基础 share link"换成本终端 uuid(cred_ref),
//   复用节点 reality 参数(pbk/sid/sni);SS:由节点 public_ip/port + profile method + 本终端密码拼 SIP002(R-010)。
// 见 docs/current/51 §11.4。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { buildSeatShareLink } from '@/lib/clients/node-client-admin'
import { loadSeatLinkNode } from '@/lib/clients/seat-link-context'
import { subscriptionResponse } from '@/lib/subscription/clientResponse'

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

  // 2) 节点链接上下文 → 3) 按协议生成本终端链接(remark 用 label 或 email)
  const linkNode = await loadSeatLinkNode(admin, (client as any).node_id)
  const link = buildSeatShareLink(linkNode, {
    cred_ref: (client as any).cred_ref,
    label: (client as any).label,
    email: (client as any).email,
  })
  if (!link) {
    // 优雅降级:节点订阅内容尚未就绪(vless 无 base 链接 / SS 缺公网地址或端口)→ 返回空订阅(200,不报错、不造假)
    return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // 4) SDD 61:Clash 类客户端 → sublink-worker 转 clash yaml;其它 → base64。失败回落 base64。
  return subscriptionResponse(_req, [link])
}
