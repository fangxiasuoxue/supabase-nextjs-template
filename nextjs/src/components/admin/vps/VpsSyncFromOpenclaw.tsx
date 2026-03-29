// @ts-nocheck
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { RefreshCw, Download, Loader2 } from 'lucide-react'

interface VmRow {
  gcp_instance_name: string
  public_ip: string
  zone: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

export function VpsSyncFromOpenclaw({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [rows, setRows] = useState<VmRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [synced, setSynced] = useState<number | null>(null)

  const fetchList = async () => {
    setLoading(true)
    setSynced(null)
    try {
      const res = await fetch('/api/v1/admin/vps/list-with-billing')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // openclaw 数据（billing 字段存在）作为"可导入"来源
      const list: VmRow[] = (json.data || [])
        .filter((v: any) => v.gcp_instance_name)
        .map((v: any) => ({
          gcp_instance_name: v.gcp_instance_name,
          public_ip: v.public_ip ?? '',
          zone: v.zone ?? '',
        }))
      setRows(list)
      setSelected(new Set(list.map((r) => r.gcp_instance_name)))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/v1/admin/vps/sync-from-openclaw', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSynced(json.synced)
      toast.success(`同步完成，共导入 ${json.synced} 台实例`)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSyncing(false)
    }
  }

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) fetchList() }}>
      <DialogContent className="max-w-lg bg-card/95 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base font-black uppercase tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Download className="h-4 w-4 text-primary" />
            </div>
            从 OpenClaw 同步采集
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-72 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/40 text-xs uppercase tracking-widest">
              未检测到 openclaw 实例
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.gcp_instance_name} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <Checkbox
                  checked={selected.has(row.gcp_instance_name)}
                  onCheckedChange={() => toggle(row.gcp_instance_name)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black uppercase truncate">{row.gcp_instance_name}</div>
                  <div className="text-[9px] tech-mono text-muted-foreground/50">{row.public_ip} · {row.zone}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {synced !== null && (
          <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest text-center">
            ✓ 已同步 {synced} 台实例
          </div>
        )}

        <DialogFooter className="gap-3 mt-2">
          <Button variant="ghost" className="rounded-2xl h-11 font-bold text-xs uppercase" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button onClick={fetchList} variant="outline" disabled={loading} className="rounded-2xl h-11 font-bold text-xs uppercase border-white/10">
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新列表
          </Button>
          <Button onClick={handleSync} disabled={syncing || selected.size === 0} className="flex-1 rounded-2xl h-11 font-black uppercase text-xs">
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {syncing ? '同步中...' : `同步 ${selected.size} 台`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
