'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, PackageSearch } from 'lucide-react'

type AssetPayload = {
  vps: any[]
  nodes: any[]
  clients: any[]
  ips: any[]
}

export function UserAssetsDialog({ user }: { user: { id: string; email?: string | null } }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AssetPayload | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/assets`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setData(json)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
        <span className="text-xs font-black uppercase tracking-widest text-slate-700">{title}</span>
        <span className="text-[10px] font-bold text-muted-foreground">{count}</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">{children}</div>
    </div>
  )

  return (
    <>
      <Button variant="ghost" size="sm" onClick={load} className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest">
        <PackageSearch className="h-3.5 w-3.5 mr-1" />资产
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">用户授权资产 · {user.email || user.id}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="VPS" count={data.vps.length}>
                {data.vps.length === 0 ? <div className="p-3 text-xs text-muted-foreground">暂无</div> : data.vps.map((r, i) => (
                  <div key={i} className="p-3 text-xs">
                    <div className="font-bold">{r.asset?.name || r.asset?.gcp_instance_name || r.asset?.id}</div>
                    <div className="text-muted-foreground font-mono">{r.asset?.provider || '-'} · {String(r.asset?.public_ip || r.asset?.region || '-')} · {r.grant?.level || 'allocated'}</div>
                  </div>
                ))}
              </Section>
              <Section title="IP" count={data.ips.length}>
                {data.ips.length === 0 ? <div className="p-3 text-xs text-muted-foreground">暂无</div> : data.ips.map((r, i) => (
                  <div key={i} className="p-3 text-xs">
                    <div className="font-bold">{r.allocation?.display_name || r.allocation?.notes || r.asset?.remark || r.asset?.label || r.asset?.ip}</div>
                    <div className="text-muted-foreground font-mono">{r.asset?.ip || r.asset?.id} · {r.asset?.provider || '-'} · {r.allocation?.terminate_at_period_end ? '到期停用' : '继续使用'}</div>
                  </div>
                ))}
              </Section>
              <Section title="Nodes" count={data.nodes.length}>
                {data.nodes.length === 0 ? <div className="p-3 text-xs text-muted-foreground">暂无</div> : data.nodes.map((r, i) => (
                  <div key={i} className="p-3 text-xs">
                    <div className="font-bold">{r.asset?.name || r.asset?.remark || r.asset?.id}</div>
                    <div className="text-muted-foreground font-mono">{r.asset?.public_ip || '-'} · {r.asset?.status || '-'} · {r.grant?.level || 'read'}</div>
                  </div>
                ))}
              </Section>
              <Section title="Node Clients" count={data.clients.length}>
                {data.clients.length === 0 ? <div className="p-3 text-xs text-muted-foreground">暂无</div> : data.clients.map((r, i) => (
                  <div key={i} className="p-3 text-xs">
                    <div className="font-bold">{r.asset?.label || r.asset?.email || r.asset?.id}</div>
                    <div className="text-muted-foreground font-mono">node={r.asset?.node_id || '-'} · {r.asset?.enabled ? 'enabled' : 'disabled'} · {r.grant?.level || 'read'}</div>
                  </div>
                ))}
              </Section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
