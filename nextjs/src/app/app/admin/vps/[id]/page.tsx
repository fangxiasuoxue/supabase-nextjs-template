'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Server } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VpsAgentStatusPanel } from '@/components/admin/vps/VpsAgentStatusPanel'
import { VpsTrafficSparkline } from '@/components/admin/vps/VpsTrafficSparkline'

export default function VpsDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [vps, setVps] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/admin/vps/list-with-billing')
      .then((r) => r.json())
      .then((json) => {
        const found = (json.data || []).find((v: any) => v.id === id)
        setVps(found ?? null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
    </div>
  )

  if (!vps) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground/40">
      <Server className="h-12 w-12" />
      <span className="text-xs uppercase tracking-widest">VPS 不存在</span>
      <Link href="/app/admin/vps" className="text-primary text-xs underline">返回列表</Link>
    </div>
  )

  const heartbeatColor =
    vps.heartbeat_status === 'online' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20'
    : vps.heartbeat_status === 'offline' ? 'text-red-400 bg-red-500/10 border-red-400/20'
    : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/admin/vps" className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">{vps.gcp_instance_name ?? vps.id}</h2>
          <p className="text-muted-foreground text-sm">{vps.public_ip} · {vps.zone}</p>
        </div>
        <div className={`ml-auto inline-flex px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${heartbeatColor}`}>
          {vps.heartbeat_status ?? 'unknown'}
        </div>
      </div>

      {/* Basic Info Card */}
      <div className="glass-card-premium p-6 rounded-[2rem] border border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Provider', value: vps.provider ?? 'gcp' },
          { label: 'Zone', value: vps.zone ?? '--' },
          { label: 'Public IP', value: vps.public_ip ?? '--' },
          { label: 'Agent 版本', value: vps.agent_version ?? '--' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black">{item.label}</span>
            <span className="tech-mono text-sm font-black">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="agent">
        <TabsList className="bg-white/5 border border-white/5 rounded-xl p-1">
          <TabsTrigger value="agent" className="rounded-lg text-xs font-black uppercase tracking-widest data-[state=active]:bg-white/10">Agent 状态</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg text-xs font-black uppercase tracking-widest data-[state=active]:bg-white/10">账单 &amp; 流量</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-6">
          <VpsAgentStatusPanel
            vpsId={id}
            lastSyncAt={vps.last_sync_at ?? null}
            lastSyncBatchId={vps.last_sync_batch_id ?? null}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <div className="glass-card-premium p-6 rounded-2xl border border-white/5">
            <VpsTrafficSparkline billing={vps.billing} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
