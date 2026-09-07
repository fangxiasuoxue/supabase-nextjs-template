import { createHash } from 'crypto'

export type SubscriptionProtocol = 'vless' | 'vmess' | 'ss' | 'trojan' | 'hysteria2' | 'hy2' | 'tuic'

export interface SafeSubscriptionItem {
  external_key: string
  display_name: string
  protocol: SubscriptionProtocol
  server_hint: string | null
  port_hint: number | null
  compatibility: 'supported' | 'unsupported'
}

const SCHEMES = new Set<SubscriptionProtocol>(['vless', 'vmess', 'ss', 'trojan', 'hysteria2', 'hy2', 'tuic'])
const XRAY_SUPPORTED = new Set<SubscriptionProtocol>(['vless', 'vmess', 'ss', 'trojan'])

function decodeBase64(value: string): string {
  const clean = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='), 'base64').toString('utf8')
}

/** Decode the response of sublink-worker /xray (base64 URI list) or an already plain URI list. */
export function decodeSubscriptionLinks(input: string): string[] {
  const trimmed = input.trim()
  const plain = /^[a-z0-9]+:\/\//im.test(trimmed) ? trimmed : decodeBase64(trimmed)
  return plain.split(/\r?\n/).map((x) => x.trim()).filter((x) => {
    const scheme = x.match(/^([a-z0-9]+):\/\//i)?.[1]?.toLowerCase() as SubscriptionProtocol | undefined
    return !!scheme && SCHEMES.has(scheme)
  })
}

function vmessSafe(link: string): Omit<SafeSubscriptionItem, 'external_key' | 'compatibility'> {
  const raw = link.replace(/^vmess:\/\//i, '')
  const j = JSON.parse(decodeBase64(raw))
  const port = Number(j.port)
  return {
    display_name: String(j.ps || j.add || 'VMess'),
    protocol: 'vmess',
    server_hint: j.add ? String(j.add) : null,
    port_hint: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null,
  }
}

/** Build display-only metadata. The raw link remains in memory and must never be persisted here. */
export function describeSubscriptionLink(link: string): SafeSubscriptionItem {
  const protocol = link.match(/^([a-z0-9]+):\/\//i)?.[1]?.toLowerCase() as SubscriptionProtocol | undefined
  if (!protocol || !SCHEMES.has(protocol)) throw new Error('不支持的订阅协议')
  let safe: Omit<SafeSubscriptionItem, 'external_key' | 'compatibility'>
  if (protocol === 'vmess') {
    safe = vmessSafe(link)
  } else {
    const url = new URL(link)
    const port = Number(url.port)
    safe = {
      display_name: decodeURIComponent(url.hash.replace(/^#/, '')) || url.hostname || protocol.toUpperCase(),
      protocol,
      server_hint: url.hostname || null,
      port_hint: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null,
    }
  }
  // Stable without leaking the credential-bearing URI into DB/logs.
  const external_key = createHash('sha256').update(link).digest('hex')
  return { ...safe, external_key, compatibility: XRAY_SUPPORTED.has(protocol) ? 'supported' : 'unsupported' }
}

export function describeXraySubscription(input: string): SafeSubscriptionItem[] {
  return decodeSubscriptionLinks(input).map(describeSubscriptionLink)
}

function validPort(value: string | number): number {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Endpoint 端口无效')
  return port
}

function streamSettings(network: string, security: string, p: URLSearchParams, fallbackSni?: string) {
  const net = network || 'tcp'
  const out: Record<string, any> = { network: net, security: security || 'none' }
  if (net === 'ws') out.wsSettings = { path: p.get('path') || '/', ...(p.get('host') ? { headers: { Host: p.get('host') } } : {}) }
  if (net === 'grpc') out.grpcSettings = { serviceName: p.get('serviceName') || p.get('service_name') || '', multiMode: p.get('mode') === 'multi' }
  if (net === 'http' || net === 'h2') out.httpSettings = { path: p.get('path') || '/', ...(p.get('host') ? { host: p.get('host')!.split(',') } : {}) }
  if (security === 'reality') {
    const publicKey = p.get('pbk') || p.get('publicKey')
    const serverName = p.get('sni') || fallbackSni
    if (!publicKey || !serverName) throw new Error('VLESS Reality 缺少 pbk/sni')
    out.realitySettings = {
      serverName,
      publicKey,
      fingerprint: p.get('fp') || 'chrome',
      shortId: p.get('sid') || '',
      spiderX: p.get('spx') || '',
    }
  } else if (security === 'tls') {
    out.tlsSettings = { serverName: p.get('sni') || fallbackSni || '', ...(p.get('alpn') ? { alpn: p.get('alpn')!.split(',') } : {}) }
  }
  return out
}

function compileVless(link: string, tag: string) {
  const url = new URL(link)
  const id = decodeURIComponent(url.username)
  if (!id || !url.hostname) throw new Error('VLESS Endpoint 参数不完整')
  const flow = url.searchParams.get('flow')
  return {
    tag, protocol: 'vless',
    settings: { vnext: [{ address: url.hostname, port: validPort(url.port), users: [{ id, encryption: url.searchParams.get('encryption') || 'none', ...(flow ? { flow } : {}) }] }] },
    streamSettings: streamSettings(url.searchParams.get('type') || 'tcp', url.searchParams.get('security') || 'none', url.searchParams, url.hostname),
  }
}

function compileTrojan(link: string, tag: string) {
  const url = new URL(link)
  const password = decodeURIComponent(url.username)
  if (!password || !url.hostname) throw new Error('Trojan Endpoint 参数不完整')
  return {
    tag, protocol: 'trojan',
    settings: { servers: [{ address: url.hostname, port: validPort(url.port), password }] },
    streamSettings: streamSettings(url.searchParams.get('type') || 'tcp', url.searchParams.get('security') || 'tls', url.searchParams, url.hostname),
  }
}

function compileVmess(link: string, tag: string) {
  const j = JSON.parse(decodeBase64(link.replace(/^vmess:\/\//i, '')))
  const address = String(j.add || '')
  const id = String(j.id || '')
  if (!address || !id) throw new Error('VMess Endpoint 参数不完整')
  const p = new URLSearchParams()
  if (j.host) p.set('host', String(j.host))
  if (j.path) p.set('path', String(j.path))
  if (j.sni) p.set('sni', String(j.sni))
  if (j.alpn) p.set('alpn', String(j.alpn))
  if (j.type) p.set('type', String(j.type))
  const security = String(j.tls || 'none') === 'tls' ? 'tls' : 'none'
  return {
    tag, protocol: 'vmess',
    settings: { vnext: [{ address, port: validPort(j.port), users: [{ id, alterId: Number(j.aid || 0), security: String(j.scy || 'auto') }] }] },
    streamSettings: streamSettings(String(j.net || 'tcp'), security, p, address),
  }
}

function compileShadowsocks(link: string, tag: string) {
  const body = link.replace(/^ss:\/\//i, '').split('#', 1)[0].split('?', 1)[0]
  let methodPassword: string
  let hostPort: string
  const at = body.lastIndexOf('@')
  if (at >= 0) {
    methodPassword = decodeBase64(decodeURIComponent(body.slice(0, at)))
    hostPort = body.slice(at + 1)
  } else {
    const decoded = decodeBase64(decodeURIComponent(body))
    const split = decoded.lastIndexOf('@')
    if (split < 0) throw new Error('Shadowsocks Endpoint 参数不完整')
    methodPassword = decoded.slice(0, split)
    hostPort = decoded.slice(split + 1)
  }
  const colon = methodPassword.indexOf(':')
  if (colon < 1) throw new Error('Shadowsocks method/password 无效')
  const method = methodPassword.slice(0, colon)
  const password = methodPassword.slice(colon + 1)
  const parsed = new URL(`ss://${hostPort}`)
  if (!parsed.hostname || !password) throw new Error('Shadowsocks Endpoint 参数不完整')
  return { tag, protocol: 'shadowsocks', settings: { servers: [{ address: parsed.hostname, port: validPort(parsed.port), method, password }] } }
}

/** Resolve one stable catalog item from a freshly fetched subscription and compile it in memory. */
export function compileSubscriptionOutbound(input: string, externalKey: string, tag: string): Record<string, any> {
  const link = decodeSubscriptionLinks(input).find((candidate) => createHash('sha256').update(candidate).digest('hex') === externalKey)
  if (!link) throw new Error('Endpoint 已从订阅中消失或 external_key 不匹配')
  const protocol = link.match(/^([a-z0-9]+):\/\//i)?.[1]?.toLowerCase() as SubscriptionProtocol | undefined
  if (!protocol || !XRAY_SUPPORTED.has(protocol)) throw new Error(`协议 ${protocol || 'unknown'} 暂不支持 Xray 编译`)
  if (protocol === 'vless') return compileVless(link, tag)
  if (protocol === 'vmess') return compileVmess(link, tag)
  if (protocol === 'ss') return compileShadowsocks(link, tag)
  return compileTrojan(link, tag)
}
