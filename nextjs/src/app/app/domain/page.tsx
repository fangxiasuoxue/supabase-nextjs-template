'use client'

// 域名总览 (Domain Overview) —— SDD 54 §8 (只读 P1)
// 读 console DB domain_state:域名/状态徽标(NXDOMAIN/到期临近/正常)/到期/托管NS/最后巡检。
// 结构 SSOT(注册商/属主)在 assets.yaml portfolio,尚未入库 → owner/registrar 列暂留「—」(见 TODO)。
// 镜像 admin/nodes/page.tsx:client 组件 + createSPASassClientAuthenticated + shared Table。

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { checkIsAdmin } from '@/app/actions/auth'
import { toast } from 'sonner'
import { Loader2, Globe, Search } from 'lucide-react'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DomainState, DomainRisk, domainRisk, domainRiskWeight, EXPIRE_WARN_DAYS,
} from '@/types/domain'

// 状态徽标样式 + 文案(依据 §8:🔴NXDOMAIN / ⚠️到期临近 / ✅正常)
const RISK_META: Record<DomainRisk, { label: string; cls: string }> = {
  nxdomain: { label: '🔴 NXDOMAIN', cls: 'text-red-700 bg-red-50 border-red-200' },
  expiring: { label: '⚠️ 到期临近', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  normal: { label: '✅ 正常', cls: 'text-green-700 bg-green-50 border-green-200' },
}

function fmtExpiry(d: DomainState): string {
  if (!d.expires_at) return '—'
  const dt = new Date(d.expires_at).toLocaleDateString()
  if (d.days_to_expiry == null) return dt
  const days = d.days_to_expiry
  const rel = days < 0 ? `已过期 ${-days} 天` : `剩 ${days} 天`
  return `${dt} · ${rel}`
}

export default function DomainOverviewPage() {
  const [domains, setDomains] = useState<DomainState[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const fetchDomains = useCallback(async () => {
    try {
      const supabase = await createSPASassClientAuthenticated()
      const client = supabase.getSupabaseClient() as any
      // 分域 RBAC(SDD 54 P4,mirror 53):admin 全见;非 admin 只见 domain_grants 授权给自己的域名。
      const isAdmin = await checkIsAdmin()
      let allowed: Set<string> | null = null
      if (!isAdmin) {
        // domain_grants RLS 自读(user_id = auth.uid())→ 只回自己的授权行
        const { data: grants } = await client.from('domain_grants').select('domain')
        allowed = new Set((grants ?? []).map((g: any) => g.domain))
      }
      const { data, error } = await client
        .from('domain_state')
        .select('domain, observed_ns, nxdomain, expires_at, days_to_expiry, registrant_verified, last_checked, note, updated_at')
      if (error) throw error
      let rows = (data ?? []) as DomainState[]
      if (allowed) rows = rows.filter((d) => allowed!.has(d.domain))
      setDomains(rows)
    } catch (e: any) {
      toast.error('加载域名列表失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDomains() }, [fetchDomains])

  // 过滤(域名搜索)+ 按风险排序(NXDOMAIN + 快到期在前)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? domains.filter((d) => d.domain.toLowerCase().includes(q)) : domains
    return [...filtered].sort((a, b) => {
      const w = domainRiskWeight(b) - domainRiskWeight(a)
      return w !== 0 ? w : a.domain.localeCompare(b.domain)
    })
  }, [domains, query])

  const nxCount = useMemo(() => domains.filter((d) => d.nxdomain).length, [domains])
  const expiringCount = useMemo(
    () => domains.filter((d) => !d.nxdomain && d.days_to_expiry != null && d.days_to_expiry <= EXPIRE_WARN_DAYS).length,
    [domains],
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 text-cyan-600 mb-1">
            <Globe className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">Domain Management</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">域名总览</h2>
          <p className="text-muted-foreground text-sm">
            域名资产运行态台账 · 到期 / 失联(NXDOMAIN) / 权威 NS 巡检
          </p>
        </div>
        <div className="flex items-center gap-3">
          {nxCount > 0 && (
            <span className="inline-flex px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest text-red-700 bg-red-50 border-red-200">
              {nxCount} 失联
            </span>
          )}
          {expiringCount > 0 && (
            <span className="inline-flex px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border-amber-200">
              {expiringCount} 到期临近
            </span>
          )}
        </div>
      </div>

      {/* 搜索 / 过滤 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索域名…"
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
        </div>
      ) : (
        <div className="glass-card-premium rounded-[2.5rem] overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-transparent h-14">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pl-8">域名</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">状态</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">到期</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">托管 NS</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">最后巡检</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pr-8 text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                      <Globe className="h-10 w-10" />
                      <span className="text-xs font-black uppercase tracking-widest">
                        {query ? '无匹配域名' : '暂无域名'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visible.map((d) => {
                const risk = RISK_META[domainRisk(d)]
                const ns = d.observed_ns && d.observed_ns.length > 0 ? d.observed_ns.join(', ') : '—'
                return (
                  <TableRow key={d.domain} className="border-slate-200 hover:bg-slate-50 h-16 group/row">
                    <TableCell className="pl-8">
                      <Link
                        href={`/app/domain/${encodeURIComponent(d.domain)}`}
                        className="tech-mono text-sm font-bold text-slate-800 hover:text-cyan-700 transition-colors"
                      >
                        {d.domain}
                      </Link>
                      {d.note && (
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5 line-clamp-1 max-w-[220px]">{d.note}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${risk.cls}`}>
                        {risk.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground/80">{fmtExpiry(d)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="tech-mono text-[11px] text-muted-foreground/60 line-clamp-1 max-w-[240px]" title={ns}>{ns}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground/50">
                        {d.last_checked ? new Date(d.last_checked).toLocaleString() : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Link
                        href={`/app/domain/${encodeURIComponent(d.domain)}`}
                        className="inline-flex h-8 items-center rounded-lg px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:bg-cyan-50 hover:text-cyan-700 transition-all"
                      >
                        查看
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
