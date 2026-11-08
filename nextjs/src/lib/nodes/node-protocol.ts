// 节点协议派生:nodes.protocol 必须来自所选 node_profile,而不是硬编码。
//
// 事故(2026-11-08,PRD console-v2 R-010 (e)):deploy 路由写死 protocol='vless',选 SS 模板建出的节点
// 列表显示 vless、席位按 vless 生成 uuid、agent 向 SS 入站加客户端被拒 → 下发列全红。
// 本模块是唯一派生点,deploy 路由与表单都用它;单测见 node-protocol.test.ts。

/** DB `nodes.protocol` 词表(migration 20251206110120 的 CHECK;shadowsocks 生产仍在用)。 */
export const NODE_PROTOCOLS = ['vless', 'vmess', 'trojan', 'shadowsocks', 'socks', 'http'] as const
export type NodeProtocol = (typeof NODE_PROTOCOLS)[number]

export interface ProfileLike {
  name?: string | null
  transport_protocol?: string | null
  config_template?: Record<string, unknown> | null
}

const ALIASES: Record<string, NodeProtocol> = {
  ss: 'shadowsocks',
  shadowsocks: 'shadowsocks',
  socks5: 'socks',
  socks: 'socks',
  vless: 'vless',
  vmess: 'vmess',
  trojan: 'trojan',
  http: 'http',
}

function normalize(raw: unknown): NodeProtocol | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase()
  return ALIASES[key] ?? null
}

/**
 * 模板 → 节点协议。优先 transport_protocol,其次 config_template.protocol;
 * 都认不出时退回 'vless'(历史默认),保证返回值一定满足 nodes_protocol_check。
 */
export function nodeProtocolFromProfile(profile: ProfileLike | null | undefined, fallback: NodeProtocol = 'vless'): NodeProtocol {
  if (!profile) return fallback
  return normalize(profile.transport_protocol) ?? normalize(profile.config_template?.protocol) ?? fallback
}

/** 模板声明的监听地址(agent 缺省 0.0.0.0)。 */
export function profileListen(profile: ProfileLike | null | undefined): string | null {
  const v = profile?.config_template?.listen
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function isLoopbackListen(listen: string | null | undefined): boolean {
  if (!listen) return false
  const l = listen.trim().toLowerCase()
  return l === '127.0.0.1' || l === '::1' || l === 'localhost' || l.startsWith('127.')
}

/** 创建部署时值得提醒用户的事(不阻断):回环模板建出的落地只有机器本机能连。 */
export function deployWarningsForProfile(profile: ProfileLike | null | undefined): string[] {
  const warnings: string[] = []
  const listen = profileListen(profile)
  if (isLoopbackListen(listen)) {
    warnings.push(
      `模板「${profile?.name ?? '?'}」监听 ${listen},只在机器本机回环可达,不能作公网落地;公网落地请选 listen=0.0.0.0 的模板。`,
    )
  }
  return warnings
}
