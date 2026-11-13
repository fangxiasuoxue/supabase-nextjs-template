// Node Share-Link Builder
// 参数 → 代理分享 URL(vless-reality),及订阅内容(base64)构建。
// 与 node-url-parser.ts(解析)互补:此文件负责【生成】。
// 范围:vless-reality(SDD 36 方案 A)+ shadowsocks SIP002(R-010,2026-11-07)。hysteria/mixed 属 B 阶段。

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

export interface ShadowsocksShareParams {
  method: string // 加密方法,如 aes-128-gcm(取自节点 profile 模板 config_template.method)
  password: string // 席位密码(node_clients.cred_ref)
  host: string // 节点公网域名/IP(nodes.public_ip)
  port: number // 节点端口(nodes.port)
  remark?: string // #备注,缺省用 host
}

/** SIP002 userinfo 编码:websafe-base64(method:password),不带 padding。isomorphic。 */
function base64UrlNoPad(s: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf-8').toString('base64url')
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 构建 Shadowsocks 分享 URL(SIP002):ss://base64url(method:password)@host:port#remark。
 * 纯函数,无副作用;不依赖节点 rendered_config(SS 入站没有 base 链接,直接由节点字段拼出)。
 */
export function buildShadowsocksShareUrl(p: ShadowsocksShareParams): string {
  if (!p.method || !p.password || !p.host || !p.port) {
    throw new Error('buildShadowsocksShareUrl: 缺必填参数(method/password/host/port)')
  }
  const userinfo = base64UrlNoPad(`${p.method}:${p.password}`)
  const remark = encodeURIComponent(p.remark ?? p.host)
  return `ss://${userinfo}@${p.host}:${p.port}#${remark}`
}

export interface SocksShareParams {
  user: string // socks5 用户名(席位 cred_ref 的 "user:pass" 前半)
  pass: string // socks5 密码
  host: string // 节点公网域名/IP
  port: number // 节点端口
  remark?: string
}

/** 标准 base64(带 padding)。socks:// 链接的 userinfo 用标准 base64(v2rayN / NekoBox 形态),与 agent buildSocksLink 同一编码。 */
function base64Std(s: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf-8').toString('base64')
  return btoa(unescape(encodeURIComponent(s)))
}

/**
 * 构建 SOCKS5 分享 URL:socks://base64(user:pass)@host:port#remark(console-v2 R-012)。
 * 纯函数;不依赖 rendered_config(账号在节点字段 + 席位凭据里)。
 */
export function buildSocksShareUrl(p: SocksShareParams): string {
  if (!p.user || !p.pass || !p.host || !p.port) {
    throw new Error('buildSocksShareUrl: 缺必填参数(user/pass/host/port)')
  }
  const remark = encodeURIComponent(p.remark ?? p.host)
  return `socks://${base64Std(`${p.user}:${p.pass}`)}@${p.host}:${p.port}#${remark}`
}
