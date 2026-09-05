const SECRET_REF = /^(jms|bw|env|secret_ref):\/\//
const TAG = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const SECRET_KEYS = /(pass(word)?|token|secret|private.?key|uuid|credential|subscription.?url|share.?link)/i

export const OUTBOUND_SOURCE_KINDS = new Set(['cheap_ip', 'subscription', 'managed_node', 'manual'])
export const OUTBOUND_ENDPOINT_KINDS = new Set(['cheap_ip', 'subscription_node', 'managed_node', 'direct', 'blocked', 'manual'])
export const OUTBOUND_TRANSPORT_KINDS = new Set(['direct', 'gorelay', 'self_transit'])

export function validSecretRef(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500 && SECRET_REF.test(value)
}

export function validOutboundTag(value: unknown): value is string {
  return typeof value === 'string' && TAG.test(value)
}

/**
 * Catalog JSON is intentionally non-secret. Reject likely credentials recursively instead of
 * relying on UI discipline. Endpoint credentials and subscription URLs must use secret_ref.
 */
export function assertNonSecretJson(value: unknown, path = 'config'): void {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return
  if (typeof value === 'string') {
    if (value.length > 2000) throw new Error(`${path} 字符串过长`)
    if (/^(vless|vmess|trojan|ss|socks|https?):\/\//i.test(value)) {
      throw new Error(`${path} 不得保存 URL/分享链接;请改用 secret_ref`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNonSecretJson(item, `${path}[${i}]`))
    return
  }
  if (typeof value !== 'object') throw new Error(`${path} 类型无效`)
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.test(key)) throw new Error(`${path}.${key} 疑似凭据字段;请改用 secret_ref`)
    assertNonSecretJson(item, `${path}.${key}`)
  }
}

export function safeText(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max)
}
