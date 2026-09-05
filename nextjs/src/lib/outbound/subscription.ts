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
