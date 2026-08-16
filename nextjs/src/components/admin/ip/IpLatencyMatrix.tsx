'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Grid3x3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface MatrixRow {
  ip: string
  label?: string | null
  source_node: string
  latency_ms: number | null
  tested_at: string | null
}

// 代表列:把众多源节点归成 6 类(减少列数,不好看的明细进弹窗)。
// nodes 按真实 GCP 地域归类(us-west1=美西 / us-central1=美中);未归类的源节点仍在明细弹窗里显示。
const CATEGORIES: { key: string; title: string; nodes: string[] }[] = [
  { key: 'hk', title: '香港', nodes: ['hk1', 'hk2', 'hk4'] },
  { key: 'uswest', title: '美西', nodes: ['us1', 'us3', 'us4', 'us6', 'us7'] },
  { key: 'uscentral', title: '美中', nodes: ['us2'] },
  { key: 'useast', title: '美东', nodes: ['us5', 'us8'] },
  { key: 'openwrt', title: 'OpenWrt', nodes: ['openwrt'] },
  { key: 'gorelay', title: 'GoRelay', nodes: ['gorelay'] },
]

// 时延着色:绿 <100 / 黄 100–200 / 红 >200 / 灰 缺失
function latencyClass(latency: number | null | undefined): string {
  if (latency == null) return 'text-slate-400'
  if (latency < 100) return 'text-green-600 font-black'
  if (latency <= 200) return 'text-amber-600 font-black'
  return 'text-red-600 font-black'
}

export function IpLatencyMatrix() {
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [detailIp, setDetailIp] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(''); setNote('')
      try {
        const res = await fetch('/api/v1/admin/ip/latency-matrix')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error || '加载失败')
        setRows(Array.isArray(json.data) ? json.data : [])
        if (json.note) setNote(String(json.note))
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || '加载失败'); setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadKey])

  // 透视:每个 IP 一行;每格 = 该类下各源节点最新时延的最优(min)。
  // 同时保留 perNode(ip → {source_node → {latency, tested_at}})供弹窗。
  const { ipList, labelByIp, catCell, perNode } = useMemo(() => {
    const ipOrder: string[] = []
    const seenIp = new Set<string>()
    const lblByIp = new Map<string, string>()
    // ip → source_node → {latency, tested_at}(数据已按 tested_at desc,取首次=最新)
    const per = new Map<string, Map<string, { latency: number | null; tested_at: string | null }>>()

    for (const r of rows) {
      if (!r || !r.ip || !r.source_node) continue
      if (!seenIp.has(r.ip)) { seenIp.add(r.ip); ipOrder.push(r.ip) }
      if (r.label && !lblByIp.has(r.ip)) lblByIp.set(r.ip, r.label)
      if (!per.has(r.ip)) per.set(r.ip, new Map())
      const m = per.get(r.ip)!
      if (!m.has(r.source_node)) m.set(r.source_node, { latency: r.latency_ms ?? null, tested_at: r.tested_at })
    }

    // 每 (ip, category) 取组内最优(有效值最小);无有效值 → null
    const cc = new Map<string, number | null>()
    for (const ip of ipOrder) {
      const m = per.get(ip)!
      for (const cat of CATEGORIES) {
        let best: number | null = null
        for (const nodeName of cat.nodes) {
          const v = m.get(nodeName)
          if (v && v.latency != null) best = best == null ? v.latency : Math.min(best, v.latency)
        }
        cc.set(`${ip}::${cat.key}`, best)
      }
    }
    return { ipList: ipOrder, labelByIp: lblByIp, catCell: cc, perNode: per }
  }, [rows])

  const isEmpty = !loading && !error && ipList.length === 0

  // 弹窗:某 IP 的全部源节点明细(含未归类的)
  const detailNodes = useMemo(() => {
    if (!detailIp) return []
    const m = perNode.get(detailIp)
    if (!m) return []
    return Array.from(m.entries())
      .map(([node, v]) => ({ node, ...v }))
      .sort((a, b) => {
        if (a.latency == null && b.latency == null) return a.node.localeCompare(b.node)
        if (a.latency == null) return 1
        if (b.latency == null) return -1
        return a.latency - b.latency
      })
  }, [detailIp, perNode])

  return (
    <div className="glass-card-premium rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-100">
            <Grid3x3 className="h-5 w-5 text-cyan-600" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-[0.1em]">IP 测速矩阵</h3>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">
              代表区域 × IP 最优时延(ms)· 点行看全部节点
            </span>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="border-slate-300 hover:bg-slate-50 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest gap-2"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" /> : <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />}
          REFRESH
        </Button>
      </div>

      {/* 色标图例 */}
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />&lt;100ms</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />100–200ms</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />&gt;200ms</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" />不可达 / 无数据</span>
      </div>

      {error ? (
        <div className="p-10 text-center">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-red-600 tech-mono">{error}</span>
        </div>
      ) : loading && ipList.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">加载测速矩阵...</span>
        </div>
      ) : isEmpty ? (
        <div className="p-16 flex flex-col items-center justify-center gap-4 opacity-40">
          <div className="p-6 rounded-full bg-slate-100 border border-slate-200"><Grid3x3 className="h-10 w-10" /></div>
          <span className="text-xs font-black uppercase tracking-[0.25em] text-center">暂无测速数据(等待采集器上报)</span>
          {note && <span className="text-[9px] font-bold tech-mono lowercase text-muted-foreground/60 max-w-md text-center break-all">{note}</span>}
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-transparent h-12">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] pl-6 sticky left-0 bg-slate-50 z-10">
                  资产 / IP
                </TableHead>
                {CATEGORIES.map((cat) => (
                  <TableHead key={cat.key} className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.12em] text-center">
                    {cat.title}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipList.map((ip) => (
                <TableRow
                  key={ip}
                  onClick={() => setDetailIp(ip)}
                  className="border-slate-200 hover:bg-cyan-50/50 transition-colors h-12 cursor-pointer"
                >
                  <TableCell className="pl-6 sticky left-0 bg-white z-10 whitespace-nowrap">
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] font-black text-foreground uppercase tracking-tight">{labelByIp.get(ip) || ip}</span>
                      <span className="tech-mono text-[10px] text-cyan-700/70 font-bold">{ip}</span>
                    </div>
                  </TableCell>
                  {CATEGORIES.map((cat) => {
                    const v = catCell.get(`${ip}::${cat.key}`) ?? null
                    return (
                      <TableCell key={cat.key} className="text-center tech-mono text-[11px]">
                        <span className={latencyClass(v)}>{v != null ? `${v}ms` : '—'}</span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 明细弹窗:该 IP 全部源节点 */}
      {detailIp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailIp(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-black uppercase tracking-tight">{labelByIp.get(detailIp) || detailIp}</span>
                <span className="tech-mono text-[11px] text-cyan-700 font-bold">{detailIp}</span>
              </div>
              <button onClick={() => setDetailIp(null)} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-transparent h-9">
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest pl-4">源节点</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest text-center">时延</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest text-right pr-4">测于</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailNodes.map((n) => (
                    <TableRow key={n.node} className="border-slate-100 h-9">
                      <TableCell className="pl-4 tech-mono text-[11px] font-black uppercase">{n.node}</TableCell>
                      <TableCell className="text-center tech-mono text-[11px]">
                        <span className={latencyClass(n.latency)}>{n.latency != null ? `${n.latency}ms` : '—'}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4 tech-mono text-[9px] text-muted-foreground">
                        {n.tested_at ? new Date(n.tested_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
