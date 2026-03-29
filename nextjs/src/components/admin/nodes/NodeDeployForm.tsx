'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = await createSPASassClientAuthenticated()
        const client = supabase.getSupabaseClient() as any

        const [{ data: vps }, { data: prof }] = await Promise.all([
          client.from('vps_instances').select('id, gcp_instance_name, public_ip, heartbeat_status').eq('heartbeat_status', 'online'),
          client.from('node_profiles').select('id, name, protocol, engine').eq('enabled', true),
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
        body: JSON.stringify({ vps_id: vpsId, profile_id: profileId, deploy_mode: deployMode }),
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
    <div className="glass-card-premium p-8 rounded-[2rem] border border-white/5 space-y-7 max-w-lg">
      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">目标 VPS *</Label>
        <Select value={vpsId} onValueChange={setVpsId}>
          <SelectTrigger className="bg-black/40 border-white/5 rounded-2xl h-12">
            <SelectValue placeholder="选择在线 VPS" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-2xl">
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
          <SelectTrigger className="bg-black/40 border-white/5 rounded-2xl h-12">
            <SelectValue placeholder="选择协议模板" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-2xl">
            {profiles.length === 0 && (
              <SelectItem value="__none__" disabled>无可用模板</SelectItem>
            )}
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-bold">{p.name}</span>
                <span className="ml-2 text-[9px] text-muted-foreground uppercase">{p.protocol} · {p.engine}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">部署模式</Label>
        <Select value={deployMode} onValueChange={setDeployMode}>
          <SelectTrigger className="bg-black/40 border-white/5 rounded-2xl h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-2xl">
            <SelectItem value="auto">自动 AUTO</SelectItem>
            <SelectItem value="manual">手动 MANUAL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleDeploy}
        disabled={loading || !vpsId || !profileId}
        className="w-full rounded-2xl h-14 font-black uppercase tracking-widest shadow-[0_10px_30px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
        {loading ? '创建中...' : '创建部署任务'}
      </Button>
    </div>
  )
}
