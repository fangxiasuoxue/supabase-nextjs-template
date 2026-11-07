// P1 · 终端(seat)管理纯逻辑 —— 供 admin CRUD 端点与 /sub/* 复用。
// 设计依据:docs/current/51 §11.4;SS 席位(PRD console-v2 R-010,2026-11-07):
//   协议词表以 DB 约束 node_clients_protocol_check('vless','vmess','trojan','ss')为准,
//   console 节点协议 'shadowsocks' 在此映射为 'ss';分享链接按节点协议分发(SS 不依赖 rendered_config)。

import { randomBytes, randomUUID } from 'crypto'
import { buildShadowsocksShareUrl } from '../parsers/node-share-builder.ts'

/** 从节点名派生 slug(小写、仅 a-z0-9-)。用于生成终端 email 前缀。 */
export function nodeSlug(name: string | null | undefined): string {
  const s = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'node'
}

/** 终端 email = `<slug>-userNN@node`(NN 两位补零)。xray user email,node 内唯一。 */
export function buildSeatEmail(slug: string, seq: number): string {
  const nn = String(seq).padStart(2, '0')
  return `${slug}-user${nn}@node`
}

/**
 * 从"基础订阅 vless 链接"派生某终端的链接:仅替换 uuid 与 remark,保留 host/port/reality 参数。
 * base 形如 vless://<baseUuid>@host:443?...params...#remark。
 * 这样每个终端复用节点的 reality 参数(pbk/sid/sni),只换自己的 uuid。
 */
export function swapVlessUuid(baseLink: string, uuid: string, remark: string): string {
  const scheme = 'vless://'
  const at = baseLink.indexOf('@')
  if (!baseLink.startsWith(scheme) || at < 0) {
    throw new Error('not a vless link')
  }
  const hashIdx = baseLink.indexOf('#')
  // afterAt = "@host:port?query"(不含 fragment)
  const afterAt = hashIdx >= 0 ? baseLink.slice(at, hashIdx) : baseLink.slice(at)
  // remark 须 URL 编码:含空格/中文/特殊字符的裸 fragment 会被部分客户端(尤其 Clash Meta)
  // 判为非法链接而整段拒绝。与 node-share-builder.buildVlessRealityShareUrl 的编码保持一致。
  return `${scheme}${uuid}${afterAt}#${encodeURIComponent(remark)}`
}

/** 从节点 rendered_config 里取第一条 base share link(容错多种形状)。取不到返回 null。 */
export function extractBaseShareLink(rendered: any): string | null {
  if (!rendered) return null
  const links = rendered.share_links ?? rendered.shareLinks ?? rendered.links
  if (Array.isArray(links) && typeof links[0] === 'string' && links[0].startsWith('vless://')) {
    return links[0]
  }
  if (typeof rendered === 'string' && rendered.startsWith('vless://')) return rendered
  return null
}

/** node_clients.protocol 词表(与 DB 约束 node_clients_protocol_check 同一份)。 */
export type SeatProtocol = 'vless' | 'vmess' | 'trojan' | 'ss'

/** 节点协议(nodes.protocol / console Protocol 类型)→ 席位协议。shadowsocks/ss → 'ss';vmess/trojan 原样;其余 → 'vless'。 */
export function toSeatProtocol(nodeProtocol: string | null | undefined): SeatProtocol {
  const p = (nodeProtocol ?? '').trim().toLowerCase()
  if (p === 'shadowsocks' || p === 'ss') return 'ss'
  if (p === 'vmess' || p === 'trojan') return p
  return 'vless'
}

export function isShadowsocksProtocol(protocol: string | null | undefined): boolean {
  return toSeatProtocol(protocol) === 'ss'
}

/** 按席位协议生成凭据:ss → 24 字符随机密码(base64url,144 bit);其它 → uuid。 */
export function generateSeatCredential(protocol: SeatProtocol): string {
  if (protocol === 'ss') return randomBytes(18).toString('base64url')
  return randomUUID()
}

/** 现网 SS 入站(hk1/hk2/hk4 2433)所用加密方法;profile 模板缺 method 时的兜底。 */
export const DEFAULT_SS_METHOD = 'aes-128-gcm'

/** 从 node_profiles.config_template 取 SS 加密方法;取不到用 fallback。 */
export function ssMethodFromProfile(configTemplate: unknown, fallback: string = DEFAULT_SS_METHOD): string {
  if (configTemplate && typeof configTemplate === 'object') {
    const m = (configTemplate as Record<string, unknown>).method
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  return fallback
}

/** 生成席位分享链接所需的节点上下文(服务端由 seat-link-context.ts 从 DB 装配)。 */
export interface SeatLinkNode {
  protocol: string | null
  public_ip: string | null
  port: number | null
  ss_method?: string | null
  base_link?: string | null // vless 节点:最新 rendered_config 的 base 分享链接
}

export interface SeatLinkSeat {
  cred_ref: string | null
  label?: string | null
  email?: string | null
}

/**
 * 按节点协议分发生成某席位的直连分享链接:
 *   ss   → ss://base64url(method:password)@public_ip:port#remark(由节点字段拼出,不需要 rendered_config);
 *   其它 → 以节点 base vless 链接换 uuid(现有行为)。
 * 生成不了(缺字段 / 非法 base)返回 null,不抛错;调用方按 null 跳过或降级。
 */
export function buildSeatShareLink(node: SeatLinkNode | null | undefined, seat: SeatLinkSeat): string | null {
  if (!node || !seat.cred_ref) return null
  const remark = seat.label || seat.email || 'seat'
  try {
    if (toSeatProtocol(node.protocol) === 'ss') {
      if (!node.public_ip || !node.port) return null
      return buildShadowsocksShareUrl({
        method: node.ss_method || DEFAULT_SS_METHOD,
        password: seat.cred_ref,
        host: node.public_ip,
        port: node.port,
        remark,
      })
    }
    if (!node.base_link) return null
    return swapVlessUuid(node.base_link, seat.cred_ref, remark)
  } catch {
    return null
  }
}
