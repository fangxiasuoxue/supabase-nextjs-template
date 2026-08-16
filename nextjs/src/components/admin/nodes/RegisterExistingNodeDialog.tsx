'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Link2, ServerCog } from 'lucide-react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'

interface Props {
  onRegistered?: () => void
}

// 一键登记「已存在的落地」为 active 节点(立即可订阅,不走 pending / poller)。
export function RegisterExistingNodeDialog({ onRegistered }: Props) {
  const [open, setOpen] = useState(false)
  const [vpsList, setVpsList] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 表单字段
  const [vpsId, setVpsId] = useState('')
  const [name, setName] = useState('')
  const [inboundTag, setInboundTag] = useState('')
  const [host, setHost] = useState('')
  const [uuid, setUuid] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [shortId, setShortId] = useState('')
  const [serverName, setServerName] = useState('yahoo.com')
  const [port, setPort] = useState('443')

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const supabase = await createSPASassClientAuthenticated()
        const client = supabase.getSupabaseClient() as any
        const { data } = await client
          .from('vps_instances')
          .select('id, gcp_instance_name, name, public_ip, external_ip, heartbeat_status')
          .order('gcp_instance_name', { ascending: true })
        setVpsList(data || [])
      } catch (e: any) {
        toast.error('加载 VPS 列表失败: ' + e.message)
      }
    }
    load()
  }, [open])

  const reset = () => {
    setVpsId(''); setName(''); setInboundTag(''); setHost('')
    setUuid(''); setPublicKey(''); setShortId('')
    setServerName('yahoo.com'); setPort('443')
  }

  const handleSubmit = async () => {
    if (!name || !inboundTag || !host || !uuid || !publicKey || !shortId) {
      toast.error('请填写 节点名 / inbound_tag / 落地域名 / uuid / publicKey / shortId')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/admin/nodes/register-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vps_instance_id: vpsId || null,
          name,
          inbound_tag: inboundTag,
          host,
          uuid,
          public_key: publicKey,
          short_id: shortId,
          server_name: serverName,
          port: Number(port) || 443,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '登记失败')
      toast.success('已登记为 active 节点,订阅立即可用')
      reset()
      setOpen(false)
      onRegistered?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const field = (
    label: string, value: string, setter: (v: string) => void,
    placeholder?: string, mono = false
  ) => (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">{label}</Label>
      <Input
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className={`bg-white border-slate-300 rounded-xl h-11 ${mono ? 'tech-mono text-xs' : ''}`}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-300 hover:bg-slate-50 rounded-xl h-10 text-xs font-black uppercase tracking-widest">
          <Link2 className="mr-2 h-3.5 w-3.5" />
          登记已有落地
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-slate-200 rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <ServerCog className="h-5 w-5 text-cyan-600" />
            登记已有落地
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            把一台已 bare 化、已有 vless-reality 落地 inbound 的 VPS 直接登记为 active 节点(立即可订阅,不依赖部署 poller)。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">目标 VPS(可选)</Label>
            <Select value={vpsId} onValueChange={setVpsId}>
              <SelectTrigger className="bg-white border-slate-300 rounded-xl h-11">
                <SelectValue placeholder="选择 VPS(用于关联,可留空)" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 rounded-2xl">
                {vpsList.length === 0 && (
                  <SelectItem value="__none__" disabled>无 VPS</SelectItem>
                )}
                {vpsList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="tech-mono text-xs">{v.gcp_instance_name ?? v.name ?? v.id}</span>
                    <span className="ml-2 text-[9px] text-muted-foreground">{v.external_ip ?? v.public_ip ?? ''}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('节点名 *', name, setName, 'us9')}
            {field('inbound_tag *', inboundTag, setInboundTag, 'jd-land-us9', true)}
          </div>

          {field('落地域名 / IP *', host, setHost, 'us9.ibfvps.dpdns.org', true)}

          {field('UUID *', uuid, setUuid, '00000000-0000-...', true)}
          {field('publicKey (pbk) *', publicKey, setPublicKey, 'reality 公钥', true)}

          <div className="grid grid-cols-2 gap-3">
            {field('shortId (sid) *', shortId, setShortId, '0123abcd', true)}
            {field('serverName (SNI)', serverName, setServerName, 'yahoo.com', true)}
          </div>

          {field('落地端口', port, setPort, '443', true)}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl h-11 text-xs font-black uppercase tracking-widest">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl h-11 text-xs font-black uppercase tracking-widest"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            {submitting ? '登记中...' : '登记为 active'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
