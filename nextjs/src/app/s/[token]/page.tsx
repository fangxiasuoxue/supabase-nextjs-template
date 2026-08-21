// 公开「单终端(seat)」页 —— 客户扫码即用,只看到自己这一个订阅/链接/二维码。
// 故意公开(PUBLIC ON PURPOSE):作用域由高熵 subscribe_token 承担,天然只作用于持有者本人。
// 不需要账号登录;客户拿到 /s/<token> 一个地址即可(见对 Q2 权限问题的实现)。
// middleware 只拦 /app 未登录,/s/* 公开。

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { swapVlessUuid, extractBaseShareLink } from '@/lib/clients/node-client-admin'
import CopyRow from './copy-row'

export const dynamic = 'force-dynamic'

export default async function SeatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) notFound()

  const admin = await createServerAdminClient()
  const { data: client } = await admin
    .from('node_clients')
    .select('id, node_id, email, cred_ref, label, enabled, expires_at')
    .eq('subscribe_token', token)
    .maybeSingle()
  if (!client) notFound()
  const c = client as any

  // node base 链接 → 换本终端 uuid 得 vless 直连链接
  const { data: dep } = await admin
    .from('node_deployments')
    .select('rendered_config, created_at')
    .eq('node_id', c.node_id)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const base = extractBaseShareLink((dep as any)?.rendered_config)
  let vless: string | null = null
  if (base && c.cred_ref) {
    try {
      vless = swapVlessUuid(base, c.cred_ref, c.label || c.email)
    } catch {
      vless = null
    }
  }

  // 订阅 URL(绝对地址)
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || 'https'
  const subUrl = host ? `${proto}://${host}/sub/client/${token}` : `/sub/client/${token}`

  // 二维码:优先 vless 直连(扫码直接加节点),否则订阅 URL
  const qrTarget = vless || subUrl
  const qrDataUrl = await QRCode.toDataURL(qrTarget, { width: 260, margin: 1 })

  const now = Date.now()
  const expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false
  const status = !c.enabled ? { text: '已停用', cls: 'bg-gray-200 text-gray-600' }
    : expired ? { text: '已到期', cls: 'bg-red-100 text-red-600' }
      : { text: '正常', cls: 'bg-green-100 text-green-700' }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-gray-50 px-4 py-8 text-gray-900">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">我的节点</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${status.cls}`}>{status.text}</span>
        </div>

        <div className="mb-4 text-sm text-gray-500">
          {c.label ? <span className="mr-2">{c.label}</span> : null}
          <span className="font-mono">{c.email}</span>
        </div>

        <div className="mb-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="扫码导入" width={260} height={260} className="rounded-lg border" />
        </div>
        <p className="mb-4 text-center text-xs text-gray-400">
          用 v2rayN / sing-box / Shadowrocket 等客户端扫码即可导入
        </p>

        <div className="space-y-3">
          {vless ? <CopyRow label="vless 直连链接(扫码/导入单节点)" value={vless} /> : (
            <div className="rounded-lg border border-dashed p-3 text-xs text-gray-400">
              vless 直连链接待节点配置就绪;可先用下方订阅链接。
            </div>
          )}
          <CopyRow label="订阅链接(可自动更新)" value={subUrl} />
        </div>

        {c.expires_at ? (
          <p className="mt-4 text-center text-xs text-gray-400">
            有效期至 {new Date(c.expires_at).toLocaleString('zh-CN')}
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-center text-[11px] text-gray-400">请勿把本链接/二维码分享给他人</p>
    </main>
  )
}
