// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Deployment {
  id: string
  vps_id: string
  profile_id: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  deploy_mode: string
  created_at: string
  updated_at?: string
}

function StatusCard({ d }: { d: Deployment }) {
  const styles: Record<string, string> = {
    pending: 'border-zinc-500/30 bg-zinc-500/5',
    processing: 'border-blue-500/30 bg-blue-500/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    failed: 'border-red-500/30 bg-red-500/5',
  }
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-5 w-5 text-zinc-400 animate-pulse" />,
    processing: <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />,
    success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    failed: <XCircle className="h-5 w-5 text-red-400" />,
  }
  const labelColor: Record<string, string> = {
    pending: 'text-zinc-400',
    processing: 'text-blue-400',
    success: 'text-emerald-400',
    failed: 'text-red-400',
  }

  return (
    <div className={`glass-card-premium p-5 rounded-2xl border ${styles[d.status] ?? styles.pending} transition-all duration-500`}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{icons[d.status] ?? icons.pending}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-widest ${labelColor[d.status]}`}>
              {d.status}
            </span>
            <span className="text-[8px] text-muted-foreground/40 tech-mono">
              · {d.deploy_mode}
            </span>
          </div>
          <div className="text-[10px] tech-mono text-muted-foreground/60 truncate">
            ID: {d.id.slice(0, 16)}...
          </div>
          <div className="text-[9px] text-muted-foreground/40 mt-1">
            {new Date(d.created_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Status flow bar */}
      <div className="mt-4 flex items-center gap-1">
        {(['pending', 'processing', 'success'] as const).map((step, i) => {
          const reached = ['pending', 'processing', 'success', 'failed'].indexOf(d.status) >= i
          return (
            <div key={step} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${reached ? (d.status === 'failed' ? 'bg-red-500' : 'bg-primary') : 'bg-white/10'}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DeploymentStatusTracker() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/nodes/deployments?limit=20')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDeployments(json.data || [])
      setTotal(json.total || 0)
    } catch (e: any) {
      console.error('DeploymentStatusTracker fetch error:', e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeployments()
    const timer = setInterval(fetchDeployments, 30_000)
    return () => clearInterval(timer)
  }, [fetchDeployments])

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载部署记录...</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          共 {total} 条部署记录 · 每30s自动刷新
        </span>
        <Button variant="ghost" size="icon" onClick={fetchDeployments} className="h-8 w-8 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {deployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-4 opacity-30">
          <Clock className="h-10 w-10" />
          <span className="text-xs font-black uppercase tracking-widest">暂无部署记录</span>
        </div>
      ) : (
        <div className="space-y-3">
          {deployments.map((d) => <StatusCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  )
}
