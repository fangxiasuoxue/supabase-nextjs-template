'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Rocket } from 'lucide-react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'

export function NodeDeployForm() {
  const router = useRouter()
  const [vpsList, setVpsList] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [vpsId, setVpsId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [deployMode, setDeployMode] = useState('auto')
  const [nodeName, setNodeName] = useState('')
  const [port, setPort] = useState('443')
  const [inboundTag, setInboundTag] = useState('')
  const [host, setHost] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = await createSPASassClientAuthenticated()
        const client = supabase.getSupabaseClient() as any

        const [{ data: vps }, { data: prof }] = await Promise.all([
          client.from('vps_instances').select('id, gcp_instance_name, public_ip, heartbeat_status').eq('heartbeat_status', 'online'),
          client.from('node_profiles').select('id, name, transport_protocol, engine').eq('enabled', true),
        ])
        setVpsList(vps || [])
        setProfiles(prof || [])
      } catch (e: any) {
        toast.error('加载数据失败: ' + e.message)
      } finally {
        setFetchingData(false)
      }
    }
    load()
  }, [])

  const handleDeploy = async () => {
    if (!vpsId || !profileId) {
      toast.error('请选择目标 VPS 和协议模板')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/nodes/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vps_id: vpsId,
          profile_id: profileId,
          deploy_mode: deployMode,
          node_name: nodeName.trim() || undefined,
          port: Number(port) || 443,
          inbound_tag: inboundTag.trim() || undefined,
          public_ip: host.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '创建失败')
      toast.success('部署任务已创建')
      router.push('/app/admin/nodes/deployments')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (fetchingData) return (
    <div className="flex items-center justify-center h-48 gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载配置...</span>
    </div>
  )

  return (
    <div className="glass-card-premium p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-7 max-w-lg">
      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">目标 VPS *</Label>
        <Select value={vpsId} onValueChange={(v) => {
          setVpsId(v)
          const sel = vpsList.find((x) => x.id === v)
          // 从 gcp_instance_name(如 us8-2026...)推 sitecode,自动建议落地域名/inbound_tag
          const site = String(sel?.gcp_instance_name ?? '').split('-')[0]
          if (site) {
            if (!host) setHost(`${site}.ibfvps.dpdns.org`)
            if (!inboundTag) setInboundTag(`jd-land-${site}`)
            if (!nodeName) setNodeName(`${site.toUpperCase()}-reality`)
          }
        }}>
          <SelectTrigger className="bg-white border-slate-300 rounded-2xl h-12">
            <SelectValue placeholder="选择在线 VPS" />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 rounded-2xl">
            {vpsList.length === 0 && (
              <SelectItem value="__none__" disabled>无在线 VPS</SelectItem>
            )}
            {vpsList.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="tech-mono text-xs">{v.gcp_instance_name ?? v.id}</span>
                <span className="ml-2 text-[9px] text-muted-foreground">{v.public_ip}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">协议模板 *</Label>
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger className="bg-white border-slate-300 rounded-2xl h-12">
            <SelectValue placeholder="选择协议模板" />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 rounded-2xl">
            {profiles.length === 0 && (
              <SelectItem value="__none__" disabled>无可用模板</SelectItem>
            )}
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-bold">{p.name}</span>
                <span className="ml-2 text-[9px] text-muted-foreground uppercase">{p.transport_protocol} · {p.engine}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">节点名</Label>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="US8-reality" className="bg-white border-slate-300 rounded-2xl h-12" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">端口</Label>
          <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" className="bg-white border-slate-300 rounded-2xl h-12" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">落地地址(域名或IP)</Label>
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="us8.ibfvps.dpdns.org" className="bg-white border-slate-300 rounded-2xl h-12" />
        <p className="text-[9px] text-muted-foreground">用稳定域名(cf-ddns 维护),分享链接以此为 host</p>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">inbound tag</Label>
        <Input value={inboundTag} onChange={(e) => setInboundTag(e.target.value)} placeholder="jd-land-us8" className="bg-white border-slate-300 rounded-2xl h-12" />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">部署模式</Label>
        <Select value={deployMode} onValueChange={setDeployMode}>
          <SelectTrigger className="bg-white border-slate-300 rounded-2xl h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 rounded-2xl">
            <SelectItem value="auto">自动 AUTO</SelectItem>
            <SelectItem value="manual">手动 MANUAL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleDeploy}
        disabled={loading || !vpsId || !profileId}
        className="w-full rounded-2xl h-14 font-black uppercase tracking-widest shadow-sm transition-all active:scale-[0.98]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
        {loading ? '创建中...' : '创建部署任务'}
      </Button>
    </div>
  )
}
