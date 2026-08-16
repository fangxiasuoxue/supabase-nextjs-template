// Node Share-Link Builder
// 参数 → 代理分享 URL(vless-reality),及订阅内容(base64)构建。
// 与 node-url-parser.ts(解析)互补:此文件负责【生成】。
// 范围:仅 vless-reality(SDD 36 方案 A)。hysteria/mixed 属 B 阶段。

export interface VlessRealityShareParams {
  uuid: string
  host: string // 稳定域名 usN.ibfvps.dpdns.org(优先)或 IP
  port?: number // 默认 443
  serverName: string // reality dest 的 SNI,如 yahoo.com → 参数 sni
  publicKey: string // reality 公钥 → pbk
  shortId: string // → sid
  flow?: string // 默认 xtls-rprx-vision
  fingerprint?: string // 默认 chrome → fp
  remark?: string // #备注,缺省用 host
  // 说明:ML-DSA-65 是【服务端】设置;客户端分享链接【不需要】带 mldsa/pqv 参数,
  //       标准 reality 链接即可连(2026-08-16 v2rayN 实测确认)。故此 builder 不含 mldsa。
}

/** 构建 vless-reality 分享 URL。纯函数,无副作用。 */
export function buildVlessRealityShareUrl(p: VlessRealityShareParams): string {
  if (!p.uuid || !p.host || !p.publicKey || !p.shortId || !p.serverName) {
    throw new Error('buildVlessRealityShareUrl: 缺必填参数(uuid/host/publicKey/shortId/serverName)')
  }
  const port = p.port ?? 443
  const q = new URLSearchParams()
  q.set('encryption', 'none')
  q.set('flow', p.flow ?? 'xtls-rprx-vision')
  q.set('security', 'reality')
  q.set('sni', p.serverName)
  q.set('fp', p.fingerprint ?? 'chrome')
  q.set('pbk', p.publicKey)
  q.set('sid', p.shortId)
  q.set('type', 'tcp') // xray raw 传输在分享 URI 里表示为 tcp
  q.set('headerType', 'none') // v2rayN 兼容(raw 无伪装头)
  const remark = encodeURIComponent(p.remark ?? p.host)
  return `vless://${p.uuid}@${p.host}:${port}?${q.toString()}#${remark}`
}

/** 把若干分享链接打包成标准订阅内容:base64( link1\nlink2\n... )。isomorphic。 */
export function buildSubscription(shareLinks: string[]): string {
  const body = shareLinks.filter(Boolean).join('\n')
  if (typeof Buffer !== 'undefined') return Buffer.from(body, 'utf-8').toString('base64')
  // 浏览器兜底(UTF-8 安全)
  return btoa(unescape(encodeURIComponent(body)))
}

/** rendered_config 结构(与 /sub/[token] 的 extractSubscription 兼容)。 */
export function buildRenderedConfig(shareLinks: string[]): {
  share_links: string[]
  subscription: string
} {
  return { share_links: shareLinks, subscription: buildSubscription(shareLinks) }
}
