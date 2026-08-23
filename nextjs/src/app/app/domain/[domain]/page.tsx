'use client'

// 域名详情 (Domain Detail) —— SDD 54 §8 (只读 P1)
// 一个域:domain_state 元数据(状态/到期/注册人验证/NS/最后巡检/备注)+ 其关键解析记录表(dns_record)。
// 镜像 admin/nodes/[id]/clients/page.tsx:client 组件 + Next15 params Promise + shared Table。
// 写(增删改解析)不在本轮范围(走 SDD 47 变更事务,P3)。

import { useState, useEffect, useCallback, use as usePromise } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { checkIsAdmin } from '@/app/actions/auth'
import { toast } from 'sonner'
import { Loader2, Globe, ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, FileCheck2 } from 'lucide-react'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DomainAssignButton } from '@/components/admin/DomainAssignButton'
import {
  DomainState, DnsRecord, DomainBeian, DomainRisk, domainRisk,
} from '@/types/domain'

const RISK_META: Record<DomainRisk, { label: string; cls: string }> = {
  nxdomain: { label: '🔴 NXDOMAIN', cls: 'text-red-700 bg-red-50 border-red-200' },
  expiring: { label: '⚠️ 到期临近', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  normal: { label: '✅ 正常', cls: 'text-green-700 bg-green-50 border-green-200' },
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</div>
      <div className="text-sm font-bold text-slate-800 break-words">{children}</div>
    </div>
  )
}

export default function DomainDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = usePromise(params)
  const domain = decodeURIComponent(rawDomain)

  const [state, setState] = useState<DomainState | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [beian, setBeian] = useState<DomainBeian | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchDetail = useCallback(async () => {
    try {
      const supabase = await createSPASassClientAuthenticated()
      const client = supabase.getSupabaseClient() as any
      // 分域 RBAC(SDD 54 P4,mirror 53):admin 全见;非 admin 需 domain_grants 授权本域,否则 403 门。
      const admin = await checkIsAdmin()
      setIsAdmin(admin)
      if (!admin) {
        const { data: grant } = await client.from('domain_grants')
          .select('domain').eq('domain', domain).maybeSingle()
        if (!grant) { setForbidden(true); return }
      }
      const [{ data: st, error: stErr }, { data: recs, error: recErr }, { data: bn }] = await Promise.all([
        client.from('domain_state').select('*').eq('domain', domain).maybeSingle(),
        client.from('dns_record').select('*').eq('domain', domain)
          .order('type', { ascending: true }).order('name', { ascending: true }),
        client.from('domain_beian').select('*').eq('domain', domain).maybeSingle(),
      ])
      if (stErr) throw stErr
      if (recErr) throw recErr
      if (!st) { setNotFound(true); return }
      setState(st as DomainState)
      setRecords((recs ?? []) as DnsRecord[])
      setBeian((bn ?? null) as DomainBeian | null)
    } catch (e: any) {
      toast.error('加载域名详情失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [domain])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="space-y-6">
        <Link href="/app/domain" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-cyan-700 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回域名总览
        </Link>
        <div className="glass-card-premium rounded-[2.5rem] p-16 flex flex-col items-center justify-center gap-4 opacity-50">
          <ShieldAlert className="h-12 w-12 text-red-500" />
          <span className="text-sm font-black uppercase tracking-widest">无权访问域名 {domain}</span>
          <span className="text-xs text-muted-foreground">该域名未授权给你(联系管理员在详情页「授权给用户」)。</span>
        </div>
      </div>
    )
  }

  if (notFound || !state) {
    return (
      <div className="space-y-6">
        <Link href="/app/domain" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-cyan-700 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回域名总览
        </Link>
        <div className="glass-card-premium rounded-[2.5rem] p-16 flex flex-col items-center justify-center gap-4 opacity-40">
          <Globe className="h-12 w-12" />
          <span className="text-sm font-black uppercase tracking-widest">未找到域名 {domain}</span>
        </div>
      </div>
    )
  }

  const risk = RISK_META[domainRisk(state)]
  const verified = state.registrant_verified
  const VerIcon = verified === true ? ShieldCheck : verified === false ? ShieldAlert : ShieldQuestion
  const verCls = verified === true ? 'text-green-700' : verified === false ? 'text-red-700' : 'text-slate-400'
  const verText = verified === true ? '已验证' : verified === false ? '未验证 ⚠️' : '未知'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/app/domain" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-cyan-700 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回域名总览
      </Link>

      {/* 头部:域名 + 状态徽标 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 text-cyan-600 mb-1">
            <Globe className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">Domain Detail</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight tech-mono">{state.domain}</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* 分域授权(admin 用,mirror 节点级 AssignButton)—— SDD 54 P4 */}
          {isAdmin && <DomainAssignButton domain={state.domain} />}
          <span className={`inline-flex px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${risk.cls}`}>
            {risk.label}
          </span>
        </div>
      </div>

      {/* 元数据网格 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoTile label="到期日">
          {state.expires_at ? new Date(state.expires_at).toLocaleDateString() : '—'}
        </InfoTile>
        <InfoTile label="到期倒计时">
          {state.days_to_expiry == null ? '—' : state.days_to_expiry < 0 ? `已过期 ${-state.days_to_expiry} 天` : `剩 ${state.days_to_expiry} 天`}
        </InfoTile>
        <InfoTile label="注册人邮箱验证">
          <span className={`inline-flex items-center gap-1.5 ${verCls}`}>
            <VerIcon className="h-4 w-4" /> {verText}
          </span>
        </InfoTile>
        <InfoTile label="最后巡检">
          <span className="text-xs">{state.last_checked ? new Date(state.last_checked).toLocaleString() : '—'}</span>
        </InfoTile>
        <InfoTile label="权威 NS(现网实测)">
          <span className="tech-mono text-xs">
            {state.observed_ns && state.observed_ns.length > 0 ? state.observed_ns.join(', ') : '—'}
          </span>
        </InfoTile>
        {/* 结构 SSOT(注册商/属主)在 assets.yaml portfolio,尚未入库 → 暂留占位 */}
        <InfoTile label="注册商 / 属主">
          <span className="text-muted-foreground/50">—（待 portfolio 入库）</span>
        </InfoTile>
        <InfoTile label="备注">
          <span className="text-xs">{state.note || '—'}</span>
        </InfoTile>
      </div>

      {/* 备案信息(Notion 录入 SSOT 的只读镜像 domain_beian)—— SDD 54 §8 D5 */}
      <div>
        <div className="flex items-center gap-3 mb-4 mt-2">
          <FileCheck2 className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-black uppercase tracking-[0.1em]">备案信息</h3>
          <span className="text-[10px] font-black tech-mono text-muted-foreground/50">NOTION 录入 · 只读镜像</span>
        </div>
        {beian ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoTile label="网站备案号（ICP）">
              {beian.icp_no ? <span className="tech-mono">{beian.icp_no}</span> : <span className="text-muted-foreground/50">—</span>}
            </InfoTile>
            <InfoTile label="备案主体">
              {beian.subject || <span className="text-muted-foreground/50">—</span>}
            </InfoTile>
            <InfoTile label="网站名称">
              {beian.site_name || <span className="text-muted-foreground/50">—</span>}
            </InfoTile>
            <InfoTile label="备案同步时间">
              <span className="text-xs">{beian.updated_at ? new Date(beian.updated_at).toLocaleString() : '—'}</span>
            </InfoTile>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-muted-foreground/60">
            无备案记录（未在 Notion 备案库登记，或未同步）。录入见 Notion，同步跑 sync_notion_beian.py。
          </div>
        )}
      </div>

      {/* 关键解析记录表 */}
      <div>
        <div className="flex items-center gap-3 mb-4 mt-2">
          <h3 className="text-sm font-black uppercase tracking-[0.1em]">关键解析记录</h3>
          <span className="text-[10px] font-black tech-mono text-muted-foreground/50">{records.length} RECORDS</span>
        </div>
        <div className="glass-card-premium rounded-[2.5rem] overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-transparent h-14">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pl-8">类型</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">名称</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">值</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">TTL</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Proxied</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pr-8">Managed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                      <Globe className="h-10 w-10" />
                      <span className="text-xs font-black uppercase tracking-widest">暂无关键解析记录</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id} className="border-slate-200 hover:bg-slate-50 h-14">
                  <TableCell className="pl-8">
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 border border-sky-200 text-[9px] font-black uppercase text-sky-800">
                      {r.type}
                    </span>
                  </TableCell>
                  <TableCell><span className="tech-mono text-xs text-slate-700">{r.name}</span></TableCell>
                  <TableCell>
                    <span className="tech-mono text-xs text-muted-foreground/80 line-clamp-1 max-w-[320px]" title={r.value}>
                      {r.priority != null ? `[${r.priority}] ` : ''}{r.value}
                    </span>
                  </TableCell>
                  <TableCell><span className="text-xs text-muted-foreground/60">{r.ttl ?? 'auto'}</span></TableCell>
                  <TableCell>
                    {r.proxied == null ? (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    ) : r.proxied ? (
                      <span className="inline-flex px-2 py-0.5 rounded-md border text-[9px] font-black uppercase text-orange-700 bg-orange-50 border-orange-200">橙云</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-md border text-[9px] font-black uppercase text-slate-500 bg-slate-50 border-slate-200">DNS</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-8">
                    <span className="tech-mono text-[11px] text-muted-foreground/60">{r.managed_by ?? '—'}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
