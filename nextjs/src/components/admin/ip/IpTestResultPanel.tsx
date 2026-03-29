// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface TestResult {
  id: string
  ip: string
  port: number
  success: boolean
  latency_ms: number | null
  upload_mbps: number | null
  download_mbps: number | null
  test_method: 'vercel' | 'agent'
  tested_from_ip: string | null
  error_message: string | null
  tested_at: string
}

export function IpTestResultPanel() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [method, setMethod] = useState<string>('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = method ? `?method=${method}&limit=30` : '?limit=30'
      const res = await fetch(`/api/v1/admin/ip/test-results${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResults(json.data || [])
      setTotal(json.total || 0)
    } catch (e: any) {
      console.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [method])

  useEffect(() => { fetch_() }, [fetch_])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">测试结果</span>
          <span className="text-[9px] tech-mono text-muted-foreground/40">({total} 条)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 方式过滤 */}
          {(['', 'vercel', 'agent'] as const).map((m) => (
            <button
              key={m || 'all'}
              onClick={() => setMethod(m)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${
                method === m
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'bg-white/[0.02] border-white/5 text-muted-foreground/50 hover:border-white/10'
              }`}
            >
              {m || 'ALL'}
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={fetch_} disabled={loading} className="h-8 w-8 rounded-xl">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="glass-card-premium rounded-2xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02]">
            <TableRow className="border-white/5 hover:bg-transparent h-12">
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest pl-6">IP</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">状态</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest text-right">延迟</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest text-right">上行</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest text-right">下行</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">来源</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest pr-6">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && results.length === 0 ? (
              <TableRow className="border-none">
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/40 mx-auto" />
                </TableCell>
              </TableRow>
            ) : results.length === 0 ? (
              <TableRow className="border-none">
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground/30 text-xs uppercase tracking-widest">
                  暂无测试结果
                </TableCell>
              </TableRow>
            ) : results.map((r) => {
              const isAgent = r.test_method === 'agent'
              return (
                <TableRow key={r.id} className={`border-white/5 h-14 ${isAgent ? 'hover:bg-white/[0.02]' : 'opacity-60 hover:opacity-80'}`}>
                  <TableCell className="pl-6">
                    <div className="flex flex-col">
                      <span className="tech-mono text-xs font-bold">{r.ip}</span>
                      {r.tested_from_ip && (
                        <span className="tech-mono text-[8px] text-muted-foreground/40">from {r.tested_from_ip}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${
                      r.success
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20'
                        : 'text-red-400 bg-red-500/10 border-red-400/20'
                    }`}>
                      {r.success ? 'OK' : 'FAIL'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tech-mono text-xs font-bold text-primary/80">
                      {r.latency_ms != null ? `${r.latency_ms}ms` : '--'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tech-mono text-xs text-muted-foreground/70">
                      {r.upload_mbps != null ? `${r.upload_mbps.toFixed(1)}M` : '--'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tech-mono text-xs text-muted-foreground/70">
                      {r.download_mbps != null ? `${r.download_mbps.toFixed(1)}M` : '--'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                      isAgent
                        ? 'text-primary/70 bg-primary/10 border-primary/20'
                        : 'text-muted-foreground/40 bg-white/[0.02] border-white/5'
                    }`}>
                      {r.test_method}
                    </span>
                  </TableCell>
                  <TableCell className="pr-6">
                    <span className="text-[9px] text-muted-foreground/40">
                      {new Date(r.tested_at).toLocaleString()}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
