'use client'

import { useEffect, useState } from 'react'
import { Wallet, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreditRow {
  account_id: string
  gmail: string | null
  label: string | null
  credit_balance: number | null
  credit_total: number | null
  pct: number | null
  cost_30d: number | null
  cost_source: string | null
  snapshot_date: string | null
  source: string | null
}

function toneOf(pct: number | null): string {
  if (pct == null) return 'text-slate-600'
  if (pct < 15) return 'text-red-600'
  if (pct < 40) return 'text-amber-600'
  return 'text-green-600'
}
function barOf(pct: number | null): string {
  if (pct == null) return 'bg-slate-300'
  if (pct < 15) return 'bg-red-500'
  if (pct < 40) return 'bg-amber-500'
  return 'bg-green-500'
}

export function VpsCreditCard() {
  const [rows, setRows] = useState<CreditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const res = await fetch('/api/v1/admin/vps/credits')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error || '加载失败')
        setRows(Array.isArray(json.data) ? json.data : [])
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || '加载失败'); setRows([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadKey])

  const main = rows.find((r) => r.account_id === 'google-01')
  const others = rows.filter((r) => r.account_id !== 'google-01')

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-[0.1em]">GCP 赠金 / 消费</h3>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">
              flextra 主账号看赠金 · 其余账号看近30天消费
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
          className="border-slate-300 hover:bg-slate-50 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" /> : <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />}
          刷新
        </Button>
      </div>

      {error ? (
        <div className="p-6 flex items-center justify-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" /><span className="text-xs font-bold">{error}</span>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
          暂无赠金数据(等待每日巡检抓取)
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* flextra 主账号:大卡 */}
          {main && (
            <div className="lg:col-span-1 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">flextra · {main.account_id}</span>
                <span className="text-[9px] font-bold text-muted-foreground">{main.snapshot_date}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-black tech-mono ${toneOf(main.pct)}`}>${(main.credit_balance ?? 0).toFixed(2)}</span>
                {main.credit_total != null && <span className="text-xs font-bold text-muted-foreground mb-1">/ ${main.credit_total.toFixed(0)}</span>}
              </div>
              {main.pct != null && (
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${barOf(main.pct)}`} style={{ width: `${Math.min(100, Math.max(2, main.pct))}%` }} />
                </div>
              )}
              <span className="text-[10px] text-muted-foreground font-bold truncate">{main.gmail} · 剩 {main.pct ?? '?'}%</span>
            </div>
          )}

          {/* 其余账号:紧凑网格,显示近30天消费 */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {others.map((r) => (
              <div key={r.account_id} className="rounded-lg border border-slate-200 p-2.5 flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">{r.account_id}</span>
                {r.cost_30d != null ? (
                  <>
                    <span className="text-lg font-black tech-mono text-slate-700">${r.cost_30d.toFixed(2)}</span>
                    <span className="text-[8px] text-muted-foreground/70 font-bold uppercase tracking-widest">近30天消费</span>
                  </>
                ) : r.credit_balance != null ? (
                  <>
                    <span className={`text-lg font-black tech-mono ${toneOf(r.pct)}`}>${r.credit_balance.toFixed(2)}</span>
                    <span className="text-[8px] text-muted-foreground/70 font-bold uppercase tracking-widest">赠金余额</span>
                  </>
                ) : (
                  <span className="text-sm font-bold tech-mono text-slate-300">— 待采集</span>
                )}
                <span className="text-[8px] text-muted-foreground font-bold truncate">{r.gmail || r.snapshot_date || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
