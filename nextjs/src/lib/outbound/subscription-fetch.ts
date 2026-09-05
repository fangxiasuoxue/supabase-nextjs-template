import { lookup } from 'dns/promises'
import { isIP } from 'net'

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 10_000

export function isForbiddenSubscriptionIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true
  if (isIP(ip) !== 4) return false
  const p = ip.split('.').map(Number)
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 224 || p[0] >= 240)
}

export function resolveEnvSecretRef(ref: string): string {
  if (!ref.startsWith('env://')) throw new Error('当前 discover executor 仅启用 env://；jms/bw broker 待接线')
  const name = ref.slice('env://'.length)
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(name)) throw new Error('env secret reference 格式无效')
  const value = process.env[name]
  if (!value) throw new Error(`订阅密钥引用未配置: env://${name}`)
  return value
}

async function assertPublicHttps(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error('订阅源仅允许 HTTPS')
  if (url.username || url.password) throw new Error('订阅 URL 禁止 authority 内嵌账密')
  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some((x) => isForbiddenSubscriptionIp(x.address))) {
    throw new Error('订阅域名解析到私网/保留地址，已拒绝')
  }
  return url
}

/** Fetch privately and never return/log the URL. Redirects are denied to prevent DNS/redirect SSRF. */
export async function fetchSubscriptionSecret(rawUrl: string): Promise<string> {
  const url = await assertPublicHttps(rawUrl)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'error',
      cache: 'no-store',
      headers: { 'User-Agent': 'v2rayN/7 jiedian-outbound-discovery/1' },
    })
    if (!res.ok) throw new Error(`订阅源返回 HTTP ${res.status}`)
    const length = Number(res.headers.get('content-length') || 0)
    if (length > MAX_BYTES) throw new Error('订阅响应超过 2MiB')
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) throw new Error('订阅响应超过 2MiB')
    return new TextDecoder().decode(bytes)
  } finally {
    clearTimeout(timer)
  }
}
