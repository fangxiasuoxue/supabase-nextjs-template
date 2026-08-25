// 公开「单终端(seat)」页 —— 客户扫码即用,只看到自己这一个服务接入配置/二维码。
// 故意公开(PUBLIC ON PURPOSE):作用域由高熵 subscribe_token 承担,天然只作用于持有者本人。
// 不需要账号登录;客户拿到 /s/<token> 一个地址即可(见对 Q2 权限问题的实现)。
// middleware 只拦 /app 未登录,/s/* 公开。
// 合规:此页无鉴权、可外传,展示文案一律中性业务词,不出现协议/拓扑内幕(SDD 57 P0)。

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

  // 配置 URL(绝对地址)
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || 'https'
  const subUrl = host ? `${proto}://${host}/sub/client/${token}` : `/sub/client/${token}`

  // 二维码:优先快速接入配置,否则配置 URL
  const qrTarget = vless || subUrl
  const qrDataUrl = await QRCode.toDataURL(qrTarget, { width: 260, margin: 1 })

  // 语言:此页无 LanguageContext(服务端组件),按 Accept-Language 头选择,默认中文
  const accept = (h.get('accept-language') || '').toLowerCase()
  const lang: 'zh' | 'en' = accept.includes('zh') || accept === '' ? 'zh' : 'en'
  const L = {
    zh: {
      title: '我的服务',
      disabled: '已停用', expired: '已到期', active: '正常',
      scanAlt: '扫码导入',
      scanHint: '用你的客户端应用扫码即可导入配置',
      quick: '快速接入配置(扫码 / 导入)',
      quickPending: '快速接入配置待就绪;可先用下方配置链接。',
      configLink: '配置链接(可自动更新)',
      validUntil: '有效期至',
      dontShare: '请勿把本链接 / 二维码分享给他人',
      copy: '复制', copied: '已复制',
      locale: 'zh-CN',
    },
    en: {
      title: 'My Service',
      disabled: 'Disabled', expired: 'Expired', active: 'Active',
      scanAlt: 'Scan to import',
      scanHint: 'Scan with your client app to import the configuration',
      quick: 'Quick access config (scan / import)',
      quickPending: 'Quick access config pending; use the config link below for now.',
      configLink: 'Config link (auto-updates)',
      validUntil: 'Valid until',
      dontShare: 'Do not share this link or QR code with anyone',
      copy: 'Copy', copied: 'Copied',
      locale: 'en-US',
    },
  }[lang]

  const now = Date.now()
  const expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false
  const status = !c.enabled ? { text: L.disabled, cls: 'bg-gray-200 text-gray-600' }
    : expired ? { text: L.expired, cls: 'bg-red-100 text-red-600' }
      : { text: L.active, cls: 'bg-green-100 text-green-700' }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-gray-50 px-4 py-8 text-gray-900">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{L.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${status.cls}`}>{status.text}</span>
        </div>

        <div className="mb-4 text-sm text-gray-500">
          {c.label ? <span className="mr-2">{c.label}</span> : null}
          <span className="font-mono">{c.email}</span>
        </div>

        <div className="mb-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={L.scanAlt} width={260} height={260} className="rounded-lg border" />
        </div>
        <p className="mb-4 text-center text-xs text-gray-400">{L.scanHint}</p>

        <div className="space-y-3">
          {vless ? <CopyRow label={L.quick} value={vless} copyLabel={L.copy} copiedLabel={L.copied} /> : (
            <div className="rounded-lg border border-dashed p-3 text-xs text-gray-400">{L.quickPending}</div>
          )}
          <CopyRow label={L.configLink} value={subUrl} copyLabel={L.copy} copiedLabel={L.copied} />
        </div>

        {c.expires_at ? (
          <p className="mt-4 text-center text-xs text-gray-400">
            {L.validUntil} {new Date(c.expires_at).toLocaleString(L.locale)}
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-center text-[11px] text-gray-400">{L.dontShare}</p>
    </main>
  )
}
