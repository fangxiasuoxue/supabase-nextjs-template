// P1 · 终端(seat)管理纯逻辑 —— 供 admin CRUD 端点与 /sub/client 复用。
// 设计依据:docs/current/51 §11.4。

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
  return `${scheme}${uuid}${afterAt}#${remark}`
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
