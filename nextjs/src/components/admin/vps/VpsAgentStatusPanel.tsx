'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Cpu, MemoryStick, HardDrive, Wifi, CheckCircle, XCircle } from 'lucide-react'

interface AgentStatus {
  cpu_percent: number
  memory_percent: number
  disk_used_gb: number
  rx_bytes: number
  tx_bytes: number
  service_states: Record<string, string>
  last_heartbeat_at?: string
}

interface Props {
  vpsId: string
  lastSyncAt?: string | null
  lastSyncBatchId?: string | null
}

function ProgressBar({ value, warn = 80, crit = 95, label, unit = '%' }: {
  value: number, warn?: number, crit?: number, label: string, unit?: string
}) {
  const color = value >= crit ? 'bg-red-500' : value >= warn ? 'bg-orange-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</span>
        <span className="tech-mono text-xs font-black">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}

export function VpsAgentStatusPanel({ vpsId, lastSyncAt, lastSyncBatchId }: Props) {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/vps/${vpsId}/agent-status`)
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setStatus(data)
      setError(null)
      setLastFetched(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [vpsId])

  useEffect(() => {
    fetch_()
    const timer = setInterval(fetch_, 30_000)
    return () => clearInterval(timer)
  }, [fetch_])

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">连接 Agent...</span>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-400">
      <XCircle className="h-8 w-8" />
      <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
      <button onClick={fetch_} className="text-[10px] underline text-muted-foreground">重试</button>
    </div>
  )

  if (!status) return null

  const formatBytes = (b: number) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`

  return (
    <div className="space-y-6">
      {/* 实时指标 */}
      <div className="glass-card-premium p-6 rounded-2xl border border-white/5 space-y-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">实时资源指标</span>
          {lastFetched && (
            <span className="text-[8px] tech-mono text-muted-foreground/40">
              更新于 {lastFetched.toLocaleTimeString()} · 每30s刷新
            </span>
          )}
        </div>
        <ProgressBar label="CPU 使用率" value={status.cpu_percent} />
        <ProgressBar label="内存使用率" value={status.memory_percent} />
        <ProgressBar label="磁盘已用" value={status.disk_used_gb} warn={20} crit={25} unit=" GB" />
      </div>

      {/* 网络流量 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card-premium p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="h-3.5 w-3.5 text-primary/60" />
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black">上行 TX</span>
          </div>
          <span className="tech-mono text-lg font-black text-primary/80">{formatBytes(status.tx_bytes)}</span>
        </div>
        <div className="glass-card-premium p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="h-3.5 w-3.5 text-emerald-500/60" />
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black">下行 RX</span>
          </div>
          <span className="tech-mono text-lg font-black text-emerald-400/80">{formatBytes(status.rx_bytes)}</span>
        </div>
      </div>

      {/* 服务状态 */}
      {status.service_states && Object.keys(status.service_states).length > 0 && (
        <div className="glass-card-premium p-5 rounded-2xl border border-white/5 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">服务状态</span>
          <div className="space-y-2">
            {Object.entries(status.service_states).map(([svc, state]) => (
              <div key={svc} className="flex items-center justify-between">
                <span className="text-xs font-bold tech-mono text-muted-foreground">{svc}</span>
                <div className="flex items-center gap-1.5">
                  {state === 'active' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className={`text-[10px] font-black uppercase ${state === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 批量同步状态 */}
      {lastSyncAt && (
        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground/50">
          <span className="uppercase tracking-widest font-black">上次批量同步</span>
          <span className="tech-mono flex items-center gap-2">
            {new Date(lastSyncAt).toLocaleString()}
            {Date.now() - new Date(lastSyncAt).getTime() > 4 * 3600 * 1000 && (
              <span className="text-amber-400">⚠ 同步可能延迟</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
