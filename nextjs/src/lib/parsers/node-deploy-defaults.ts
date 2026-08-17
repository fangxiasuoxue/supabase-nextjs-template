// 落地节点默认参数派生(纯函数,便于单测)。
//
// 背景/Bug:NodeDeployForm 曾用 vps_instances.gcp_instance_name(短名如 "gcp8")
// 推 sitecode,得到 "gcp8" → 落成 jd-land-gcp8 / gcp8.ibfvps.dpdns.org(域名不解析)。
// 正确来源是 vps_instances.name(长名如 "us8-20260816-065259"),首段即 sitecode "us8"。
// 本模块把这段派生抽成纯函数并回归测试,杜绝再退化。

export interface VpsLike {
  name?: string | null
  gcp_instance_name?: string | null
}

export interface NodeDefaults {
  site: string
  nodeName: string
  inboundTag: string
  host: string
  port: number
}

export const DEFAULT_DOMAIN_SUFFIX = 'ibfvps.dpdns.org'

// 推 sitecode:优先 name 首段(us8-2026… → us8);name 缺失时 gcpN → usN;再兜底原短名。
export function deriveSite(vps: VpsLike): string {
  const name = String(vps?.name ?? '').trim()
  if (name) {
    const first = name.split('-')[0].trim()
    if (first) return first
  }
  const g = String(vps?.gcp_instance_name ?? '').trim()
  const m = g.match(/^gcp(\d+)$/) // us 队:gcpN=usN(见 connectors/gcp/gcp-correspondence.md)
  if (m) return `us${m[1]}`
  return g
}

// 由 vps 实例派生落地节点默认参数(节点名/inbound tag/落地域名/端口)。
export function deriveNodeDefaults(vps: VpsLike, opts?: { domainSuffix?: string }): NodeDefaults {
  const site = deriveSite(vps)
  const suffix = opts?.domainSuffix ?? DEFAULT_DOMAIN_SUFFIX
  return {
    site,
    nodeName: site ? `${site.toUpperCase()}-reality` : '',
    inboundTag: site ? `jd-land-${site}` : '',
    host: site ? `${site}.${suffix}` : '',
    port: 443,
  }
}
