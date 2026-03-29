'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Server, Plus } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

export function VpsRegisterForm({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    gcp_instance_name: '',
    public_ip: '',
    zone: '',
    provider: 'gcp',
    gcp_project_id: '',
  })

  const handleSubmit = async () => {
    if (!form.gcp_instance_name || !form.public_ip) {
      toast.error('实例名称和公网 IP 为必填项')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/vps/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '录入失败')
      toast.success('VPS 录入成功')
      onOpenChange(false)
      setForm({ gcp_instance_name: '', public_ip: '', zone: '', provider: 'gcp', gcp_project_id: '' })
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base font-black uppercase tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            手动录入 VPS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">实例名称 *</Label>
            <Input
              placeholder="e.g. gcp-instance-001"
              value={form.gcp_instance_name}
              onChange={(e) => setForm({ ...form, gcp_instance_name: e.target.value })}
              className="bg-black/40 border-white/5 rounded-2xl h-11 tech-mono"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">公网 IP *</Label>
            <Input
              placeholder="0.0.0.0"
              value={form.public_ip}
              onChange={(e) => setForm({ ...form, public_ip: e.target.value })}
              className="bg-black/40 border-white/5 rounded-2xl h-11 tech-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">区域 Zone</Label>
              <Input
                placeholder="us-central1-a"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="bg-black/40 border-white/5 rounded-2xl h-11 tech-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">GCP 项目 ID</Label>
              <Input
                placeholder="my-project"
                value={form.gcp_project_id}
                onChange={(e) => setForm({ ...form, gcp_project_id: e.target.value })}
                className="bg-black/40 border-white/5 rounded-2xl h-11 tech-mono text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 mt-2">
          <Button variant="ghost" className="rounded-2xl h-11 font-bold text-xs uppercase" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-2xl h-11 font-black uppercase tracking-widest text-xs"
          >
            <Server className="mr-2 h-4 w-4" />
            {loading ? '录入中...' : '确认录入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
