// SDD 61 · 订阅按客户端 UA 分支返回 —— 一条订阅链接综合所有客户端。
//
// 背景:panel 的 vless 分享链接对 v2rayNG/Hiddify/Shadowrocket(吃 base64 URI 列表)正常,
//   但 Clash Meta(mihomo)要 Clash YAML、sing-box 要其 JSON、Surge 要 Surge 配置。
//   方案=同一条订阅 URL,按客户端 UA 把【已生成好的 vless 链接】内联传给 sublink-worker
//   (zz.3pay.top)对应端点,拿回该客户端能吃的配置;不认识的客户端 → 现有 base64。
//
// ⚠️ 关键(SDD 61 §4.1):必须【内联链接】,不能让 worker 去 fetch panel 订阅 URL——
//   panel 在 Vercel,Cloudflare Worker 从边缘回源 panel 会被 Vercel 拦成空。panel 本来就
//   持有这些链接,内联即可。
//
// 稳健性:base64 客户端【不调 worker】(本地直出,零依赖);需转换的客户端走短超时,
//   任何失败/非预期正文/节点过多(URL 超 CF ~16KB)→ 回落 base64,绝不 500。

import { NextResponse } from 'next/server'
import { buildSubscription } from '@/lib/parsers/node-share-builder'

// sublink-worker 基址(禁硬编码,可切自建/Docker 备份)。SDD 61 D6。
const SUBLINK_BASE = (process.env.SUBLINK_BASE_URL || 'https://zz.3pay.top').replace(/\/+$/, '')
const MAX_INLINE_URL = 15000 // CF Worker 整条 URL 上限约 16KB,留余量;超出回落 base64
const TIMEOUT_MS = 4500

// 每种目标格式:UA 特征 + sublink-worker 端点 + 返回 content-type + 正文合法性校验。
type Fmt = {
  name: string
  ua: RegExp
  endpoint: 'clash' | 'singbox' | 'surge'
  contentType: string
  valid: (body: string) => boolean
}

// 顺序敏感:先匹配更具体的(clash-verge 含 clash;sing-box 独立)。Hiddify 走 base64(它本就正常)。
const FORMATS: Fmt[] = [
  {
    name: 'clash',
    ua: /clash|mihomo|meta|verge|stash|flclash|clashx/i,
    endpoint: 'clash',
    contentType: 'text/yaml; charset=utf-8',
    valid: (b) => /(^|\n)(proxies|proxy-groups)\s*:/.test(b),
  },
  {
    name: 'singbox',
    ua: /sing-?box|SFA|SFI|SFM|SFT/i,
    endpoint: 'singbox',
    contentType: 'application/json; charset=utf-8',
    valid: (b) => {
      try {
        const j = JSON.parse(b)
        return !!j && Array.isArray(j.outbounds)
      } catch {
        return false
      }
    },
  },
  {
    name: 'surge',
    ua: /surge/i,
    endpoint: 'surge',
    contentType: 'text/plain; charset=utf-8',
    valid: (b) => /\[Proxy\]|=\s*(vless|vmess|trojan|ss|hysteria|tuic)/i.test(b),
  },
]

function base64Response(links: string[]): NextResponse {
  return new NextResponse(buildSubscription(links), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * 按请求 UA 决定订阅返回格式(一条 URL 通吃):
 *  - Clash 类 → clash yaml / sing-box 类 → sing-box json / Surge → surge(经 sublink-worker)
 *  - 其它(v2rayNG/Hiddify/Shadowrocket/未知)/ 空链接 → base64 URI 列表(本地直出,不依赖 worker)
 * 任一转换失败 → 回落 base64。幂等,除一次对 sublink-worker 的只读 GET 外无副作用。
 */
export async function subscriptionResponse(
  request: Request,
  links: string[],
  selectedRules = 'balanced'
): Promise<NextResponse> {
  const clean = links.filter(Boolean)
  const ua = request.headers.get('user-agent') || ''
  if (clean.length === 0) return base64Response(clean)

  const fmt = FORMATS.find((f) => f.ua.test(ua))
  if (!fmt) return base64Response(clean) // base64 客户端:零 worker 依赖

  const inline = clean.join('\n')
  const url = `${SUBLINK_BASE}/${fmt.endpoint}?config=${encodeURIComponent(inline)}&selectedRules=${encodeURIComponent(selectedRules)}`
  if (url.length > MAX_INLINE_URL) return base64Response(clean) // 节点过多 → 回落

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'jiedian-panel-sublink/1' }, // 非默认 UA;仅内联转换,不触发回源
      cache: 'no-store',
    })
    if (!res.ok) return base64Response(clean)
    const body = await res.text()
    if (!body || !fmt.valid(body)) return base64Response(clean)
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': fmt.contentType, 'Cache-Control': 'no-store' },
    })
  } catch {
    return base64Response(clean) // 超时/网络错 → 回落 base64
  } finally {
    clearTimeout(timer)
  }
}
