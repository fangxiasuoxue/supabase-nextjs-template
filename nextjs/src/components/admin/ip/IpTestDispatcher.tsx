'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Zap, Server } from 'lucide-react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'

interface Props {
  ipId: number
  ip: string
  port: number | null
  username: string | null
  password: string | null
  onTestComplete?: () => void
}

export function IpTestDispatcher({ ipId, ip, port, username, password, onTestComplete }: Props) {
  const [method, setMethod] = useState<'vercel' | 'agent'>('vercel')
  const [vpsId, setVpsId] = useState('')
  const [vpsList, setVpsList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (method === 'agent') {
      createSPASassClientAuthenticated().then(async (supabase) => {
        const client = supabase.getSupabaseClient() as any
        const { data } = await client
          .from('vps_instances')
          .select('id, gcp_instance_name, public_ip')
          .eq('heartbeat_status', 'online')
        setVpsList(data || [])
      })
    }
  }, [method])

  const handleTest = async () => {
    if (method === 'agent' && !vpsId) {
      toast.error('请先选择测试 VPS')
      return
    }
    setLoading(true)
    try {
      if (method === 'vercel') {
        const res = await fetch('/api/test-proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proxy_ids: [ipId] }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '测试失败')
        toast.success('Vercel 测试完成')
      } else {
        const res = await fetch('/api/v1/admin/ip/test-via-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, port, username, password, vps_id: vpsId, speed_test: true }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '测试失败')
        toast.success(`Agent 测试完成：延迟 ${json.latency_ms ?? '--'}ms`)
      }
      onTestComplete?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <div className="space-y-2">
        <Label className="text-[9px] uppercase font-black text-muted-foreground/50 tracking-widest">测试来源</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as 'vercel' | 'agent')}>
          <SelectTrigger className="bg-black/40 border-white/5 rounded-xl h-10 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-xl">
            <SelectItem value="vercel">
              <span className="font-bold">Vercel 直测</span>
              <span className="ml-2 text-[9px] text-muted-foreground">快速但不准确</span>
            </SelectItem>
            <SelectItem value="agent">
              <span className="font-bold">委托 Agent 测试</span>
              <span className="ml-2 text-[9px] text-muted-foreground">含测速，更准确</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {method === 'agent' && (
        <div className="space-y-2">
          <Label className="text-[9px] uppercase font-black text-muted-foreground/50 tracking-widest">
            <Server className="h-3 w-3 inline mr-1" />测试 VPS
          </Label>
          <Select value={vpsId} onValueChange={setVpsId}>
            <SelectTrigger className="bg-black/40 border-white/5 rounded-xl h-10 text-xs">
              <SelectValue placeholder="选择测试来源 VPS" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-xl">
              {vpsList.length === 0 && <SelectItem value="__none__" disabled>无在线 VPS</SelectItem>}
              {vpsList.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="tech-mono text-xs">{v.gcp_instance_name ?? v.id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        onClick={handleTest}
        disabled={loading}
        size="sm"
        className="w-full rounded-xl h-9 text-[10px] font-black uppercase tracking-widest"
      >
        {loading
          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Zap className="mr-1.5 h-3.5 w-3.5" />}
        {loading ? '测试中...' : method === 'agent' ? 'Agent 测试' : 'Vercel 测试'}
      </Button>
    </div>
  )
}
