'use client'

// P3 · 节点访问画像页 —— Top 域名 / 终端画像 / 分流体检。
// 设计依据:docs/current/51 §4.1。数据来自 /api/v1/admin/nodes/[id]/access。
// 需节点 xray 先开 log.access + agent accessLog.enabled(灰度)才有数据,否则为空。

import { useState, useEffect, useCallback, use as usePromise } from 'react'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Globe, Users, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

interface DomainStat { domain: string; hits: number; uniq_clients: number }
interface TerminalStat { email: string; hits: number; uniq_domains: number }
interface OutboundStat { outbound_tag: string; hits: number }
interface AccessResp {
  total_hits: number
  top_domains: DomainStat[]
  by_terminal: TerminalStat[]
  by_outbound: OutboundStat[]
}

const WINDOWS = ['24h', '7d', '30d'] as const

function pct(n: number, total: number): string {
  if (!total) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

export default function NodeAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [win, setWin] = useState<(typeof WINDOWS)[number]>('7d')
  const [data, setData] = useState<AccessResp | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/access?window=${win}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '加载失败')
      setData(j)
    } catch (e: any) {
      toast.error(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id, win])

  useEffect(() => { load() }, [load])

  const total = data?.total_hits ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/admin/nodes"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />返回节点</Button></Link>
        <h1 className="text-xl font-semibold">节点访问画像</h1>
        <div className="ml-auto flex gap-1">
          {WINDOWS.map((w) => (
            <Button key={w} variant={win === w ? 'default' : 'ghost'} size="sm" onClick={() => setWin(w)}>{w}</Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />加载中…</div>
      ) : total === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          暂无访问数据。需节点 xray 开启 <code>log.access</code> + agent <code>accessLog.enabled</code>(灰度)后才有数据。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 分流体检 */}
          <div className="border rounded-lg p-4 lg:col-span-2">
            <div className="flex items-center gap-2 font-medium mb-3"><Shuffle className="w-4 h-4" />分流体检(出口分布)· 共 {total.toLocaleString()} 次连接</div>
            <div className="space-y-2">
              {data!.by_outbound.map((o) => (
                <div key={o.outbound_tag} className="flex items-center gap-3 text-sm">
                  <span className="w-32 font-mono truncate">{o.outbound_tag}</span>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: pct(o.hits, total) }} />
                  </div>
                  <span className="w-28 text-right text-muted-foreground">{o.hits.toLocaleString()} · {pct(o.hits, total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 域名 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 font-medium mb-3"><Globe className="w-4 h-4" />Top 域名</div>
            <Table>
              <TableHeader><TableRow><TableHead>域名</TableHead><TableHead className="text-right">连接数</TableHead><TableHead className="text-right">独立源</TableHead></TableRow></TableHeader>
              <TableBody>
                {data!.top_domains.map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                    <TableCell className="text-right">{d.hits.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{d.uniq_clients}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 终端画像 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 font-medium mb-3"><Users className="w-4 h-4" />终端画像</div>
            <Table>
              <TableHeader><TableRow><TableHead>终端</TableHead><TableHead className="text-right">连接数</TableHead><TableHead className="text-right">访问域名数</TableHead></TableRow></TableHeader>
              <TableBody>
                {data!.by_terminal.map((t) => (
                  <TableRow key={t.email}>
                    <TableCell className="font-mono text-xs">{t.email}</TableCell>
                    <TableCell className="text-right">{t.hits.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{t.uniq_domains}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
