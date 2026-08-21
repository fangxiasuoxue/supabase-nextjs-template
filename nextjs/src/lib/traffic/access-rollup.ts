// P3 · 访问画像聚合 —— node_access_stat 行 → Top域名 / 终端画像 / 分流体检。
// 设计依据:docs/current/51 §4.1。供 /api/v1/admin/nodes/[id]/access 与测试复用。

export interface AccessStatRow {
  email: string
  domain: string
  outbound_tag: string
  hits: number
  uniq_clients: number
}

export interface DomainStat {
  domain: string
  hits: number
  uniq_clients: number
}
export interface TerminalStat {
  email: string
  hits: number
  uniq_domains: number
}
export interface OutboundStat {
  outbound_tag: string
  hits: number
}

export interface AccessRollup {
  total_hits: number
  top_domains: DomainStat[] // 降序
  by_terminal: TerminalStat[] // 降序 hits
  by_outbound: OutboundStat[] // 分流体检:各出口占比
}

function num(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/** 聚合行 → 画像。topN 限制域名/终端榜长度(默认 20)。 */
export function rollupAccess(rows: AccessStatRow[], topN = 20): AccessRollup {
  let total = 0
  const domains = new Map<string, DomainStat>()
  const terminals = new Map<string, { hits: number; domains: Set<string> }>()
  const outbounds = new Map<string, number>()

  for (const r of rows) {
    const hits = num(r.hits)
    total += hits
    const domain = r.domain || '(unknown)'
    const email = r.email || '(anonymous)'
    const outbound = r.outbound_tag || '(direct)'

    const d = domains.get(domain)
    if (d) {
      d.hits += hits
      d.uniq_clients += num(r.uniq_clients)
    } else {
      domains.set(domain, { domain, hits, uniq_clients: num(r.uniq_clients) })
    }

    const t = terminals.get(email)
    if (t) {
      t.hits += hits
      if (r.domain) t.domains.add(r.domain)
    } else {
      terminals.set(email, { hits, domains: new Set(r.domain ? [r.domain] : []) })
    }

    outbounds.set(outbound, (outbounds.get(outbound) ?? 0) + hits)
  }

  const top_domains = [...domains.values()]
    .sort((a, b) => b.hits - a.hits || a.domain.localeCompare(b.domain))
    .slice(0, topN)
  const by_terminal = [...terminals.entries()]
    .map(([email, v]) => ({ email, hits: v.hits, uniq_domains: v.domains.size }))
    .sort((a, b) => b.hits - a.hits || a.email.localeCompare(b.email))
    .slice(0, topN)
  const by_outbound = [...outbounds.entries()]
    .map(([outbound_tag, hits]) => ({ outbound_tag, hits }))
    .sort((a, b) => b.hits - a.hits || a.outbound_tag.localeCompare(b.outbound_tag))

  return { total_hits: total, top_domains, by_terminal, by_outbound }
}
