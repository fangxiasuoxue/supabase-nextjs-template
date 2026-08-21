'use client'

// 节点终端(seat)管理页 —— 发名额 / 启停 / 续期 / 限并发 / 删除 / 每终端订阅。
// 设计依据:docs/current/51 §11.4。走 /api/v1/admin/nodes/[id]/clients 与 /api/v1/admin/clients/[id]。

import { useState, useEffect, useCallback, use as usePromise } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Copy, ArrowLeft, RotateCcw, Gauge, CalendarClock, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { formatBytes, quotaLevel, quotaPercent, type QuotaLevel } from '@/lib/traffic/quota-format'

interface Seat {
  id: string
  email: string
  protocol: string
  label: string | null
  enabled: boolean
  expires_at: string | null
  ip_limit: number | null
  subscribe_token: string | null
  last_reconciled_at: string | null
  last_reconcile_error: string | null
  quota_bytes: number | null
  quota_period: string | null
  over_action: string | null
  period_started_at: string | null
  used_bytes: number | null
  vless_url: string | null
  created_at: string
}

interface TrafficResp {
  node_total_bytes: number
  node_uplink_bytes: number
  node_downlink_bytes: number
  terminals: { email: string; total_bytes: number }[]
}

const LEVEL_BAR: Record<QuotaLevel, string> = {
  none: 'bg-muted-foreground/40',
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  over: 'bg-red-500',
}

function QuotaCell({ used, quota }: { used: number | null; quota: number | null }) {
  if (quota == null || quota <= 0) {
    return <span className="text-xs text-muted-foreground">不限 · {formatBytes(used)}</span>
  }
  const pct = quotaPercent(used, quota) ?? 0
  const level = quotaLevel(used, quota)
  return (
    <div className="min-w-[120px]">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className={level === 'over' ? 'text-red-500 font-medium' : level === 'warn' ? 'text-amber-600' : ''}>
          {formatBytes(used)}
        </span>
        <span className="text-muted-foreground">/ {formatBytes(quota)}</span>
      </div>
      <div className="h-1.5 rounded bg-muted overflow-hidden">
        <div className={`h-full ${LEVEL_BAR[level]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

export default function NodeClientsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [batchExpiry, setBatchExpiry] = useState('')
  const [batchQuotaGB, setBatchQuotaGB] = useState('')
  const [creating, setCreating] = useState(false)
  const [traffic, setTraffic] = useState<TrafficResp | null>(null)
  const [nodeMeta, setNodeMeta] = useState<{ node_quota_bytes: number | null; node_expires_at: string | null } | null>(null)
  const trafficByEmail = new Map((traffic?.terminals ?? []).map((t) => [t.email, t.total_bytes]))
  const nodeUsedSum = seats.reduce((s, x) => s + (x.used_bytes ?? 0), 0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/clients`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '加载失败')
      setSeats(j.clients ?? [])
      setNodeMeta(j.node ?? null)
    } catch (e: any) {
      toast.error(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadTraffic = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/traffic?window=7d`)
      const j = await r.json()
      if (r.ok) setTraffic(j)
    } catch {
      /* 流量榜是次要信息,失败静默不打断名额管理 */
    }
  }, [id])

  useEffect(() => { load(); loadTraffic() }, [load, loadTraffic])

  const createSeats = async () => {
    setCreating(true)
    try {
      const expires_at = batchExpiry.trim() ? new Date(`${batchExpiry.trim()}T23:59:59Z`).toISOString() : null
      const gb = parseFloat(batchQuotaGB.trim())
      const quota_bytes = !batchQuotaGB.trim() || !Number.isFinite(gb) || gb <= 0 ? null : Math.trunc(gb * 1024 * 1024 * 1024)
      const r = await fetch(`/api/v1/admin/nodes/${id}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, label: label || null, expires_at, quota_bytes }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '发名额失败')
      toast.success(`已发 ${j.created?.length ?? 0} 个名额${expires_at ? ' · 同到期' : ''}${quota_bytes ? ' · 同配额' : ''}`)
      setLabel(''); setCount(1); setBatchExpiry(''); setBatchQuotaGB('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const patchSeat = async (seatId: string, patch: Record<string, any>) => {
    try {
      const r = await fetch(`/api/v1/admin/clients/${seatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '更新失败')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const editQuota = async (s: Seat) => {
    const cur = s.quota_bytes != null ? (s.quota_bytes / 1024 / 1024 / 1024).toString() : ''
    const input = prompt(`设置 ${s.email} 的月配额(GB;留空=不限,0=不限)`, cur)
    if (input === null) return
    const gb = parseFloat(input.trim())
    const quota_bytes = !input.trim() || !Number.isFinite(gb) || gb <= 0 ? null : Math.trunc(gb * 1024 * 1024 * 1024)
    await patchSeat(s.id, { quota_bytes, quota_period: 'monthly' })
    toast.success(quota_bytes == null ? '已设为不限' : `配额 ${input.trim()} GB`)
  }

  const rollPeriod = async (s: Seat) => {
    if (!confirm(`重置 ${s.email} 的配额周期?used 归零,被配额停用的终端下轮 poll 恢复。`)) return
    await patchSeat(s.id, { roll_period: true })
    toast.success('已滚动周期,used 归零')
  }

  const editExpiry = async (s: Seat) => {
    const cur = s.expires_at ? new Date(s.expires_at).toISOString().slice(0, 10) : ''
    const input = prompt(
      `设置 ${s.email} 到期(YYYY-MM-DD;或 +30 表示30天后;留空=不过期)。到期后 agent 下轮自动断开。`,
      cur,
    )
    if (input === null) return
    const t = input.trim()
    let expires_at: string | null
    if (!t) {
      expires_at = null
    } else if (/^\+\d+$/.test(t)) {
      expires_at = new Date(Date.now() + parseInt(t.slice(1), 10) * 86400000).toISOString()
    } else {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T23:59:59Z` : t)
      if (Number.isNaN(d.getTime())) return toast.error('日期格式无法识别(用 YYYY-MM-DD 或 +天数)')
      expires_at = d.toISOString()
    }
    await patchSeat(s.id, { expires_at })
    toast.success(expires_at ? `到期设为 ${new Date(expires_at).toLocaleString()}` : '已设为不过期')
  }

  const patchNode = async (patch: Record<string, any>) => {
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '更新失败')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const editNodeQuota = async () => {
    const cur = nodeMeta?.node_quota_bytes != null ? (nodeMeta.node_quota_bytes / 1024 / 1024 / 1024).toString() : ''
    const input = prompt('设置本节点【总流量池】GB(所有终端合计;超了整节点断。留空=不限)', cur)
    if (input === null) return
    const gb = parseFloat(input.trim())
    const node_quota_bytes = !input.trim() || !Number.isFinite(gb) || gb <= 0 ? null : Math.trunc(gb * 1024 * 1024 * 1024)
    await patchNode({ node_quota_bytes })
    toast.success(node_quota_bytes == null ? '节点总配额:不限' : `节点总配额 ${input.trim()} GB`)
  }

  const editNodeExpiry = async () => {
    const cur = nodeMeta?.node_expires_at ? new Date(nodeMeta.node_expires_at).toISOString().slice(0, 10) : ''
    const input = prompt('设置本节点【到期】(YYYY-MM-DD;或 +30 天;留空=不过期)。到期整节点全终端断。', cur)
    if (input === null) return
    const t = input.trim()
    let node_expires_at: string | null
    if (!t) node_expires_at = null
    else if (/^\+\d+$/.test(t)) node_expires_at = new Date(Date.now() + parseInt(t.slice(1), 10) * 86400000).toISOString()
    else {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T23:59:59Z` : t)
      if (Number.isNaN(d.getTime())) return toast.error('日期格式无法识别')
      node_expires_at = d.toISOString()
    }
    await patchNode({ node_expires_at })
    toast.success(node_expires_at ? `节点到期 ${new Date(node_expires_at).toLocaleString()}` : '节点:不过期')
  }

  const deleteSeat = async (seatId: string, email: string) => {
    if (!confirm(`删除名额 ${email}?agent 下轮会移除其 xray user。`)) return
    try {
      const r = await fetch(`/api/v1/admin/clients/${seatId}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '删除失败')
      toast.success('已删除')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const copySubUrl = (token: string | null) => {
    if (!token) return toast.error('无订阅 token')
    const url = `${window.location.origin}/sub/client/${token}`
    navigator.clipboard.writeText(url)
    toast.success('订阅链接已复制')
  }

  const copyVless = (url: string | null) => {
    if (!url) return toast.error('无 vless 链接(节点 base 配置未就绪)')
    navigator.clipboard.writeText(url)
    toast.success('vless 链接已复制')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/admin/nodes"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />返回节点</Button></Link>
        <h1 className="text-xl font-semibold">节点终端(名额)管理</h1>
      </div>

      {/* 节点流量榜(近 7 天) */}
      {traffic && (
        <div className="flex items-center gap-6 border rounded-lg p-4 bg-muted/30 text-sm">
          <div className="flex items-center gap-2 font-medium"><Gauge className="w-4 h-4" />近 7 天节点流量</div>
          <div>总计 <span className="font-mono">{formatBytes(traffic.node_total_bytes)}</span></div>
          <div className="text-muted-foreground">↑ {formatBytes(traffic.node_uplink_bytes)} · ↓ {formatBytes(traffic.node_downlink_bytes)}</div>
          <div className="text-muted-foreground">活跃终端 {traffic.terminals.length}</div>
        </div>
      )}

      {/* 节点级总控制:总流量池 + 节点到期(对所有终端的总量控制,命中则整节点全终端断) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border rounded-lg p-4 text-sm">
        <div className="flex items-center gap-2 font-medium"><Gauge className="w-4 h-4" />节点总控制</div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">总流量池:</span>
          {nodeMeta?.node_quota_bytes != null ? (
            <span className={quotaLevel(nodeUsedSum, nodeMeta.node_quota_bytes) === 'over' ? 'text-red-500 font-medium' : quotaLevel(nodeUsedSum, nodeMeta.node_quota_bytes) === 'warn' ? 'text-amber-600' : ''}>
              {formatBytes(nodeUsedSum)} / {formatBytes(nodeMeta.node_quota_bytes)}
            </span>
          ) : <span className="text-muted-foreground">不限(已用 {formatBytes(nodeUsedSum)})</span>}
          <Button variant="ghost" size="sm" className="h-6 px-1" title="设节点总流量池" onClick={editNodeQuota}><Gauge className="w-3 h-3" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">节点到期:</span>
          {nodeMeta?.node_expires_at
            ? <span className={new Date(nodeMeta.node_expires_at) < new Date() ? 'text-red-500 font-medium' : ''}>{new Date(nodeMeta.node_expires_at).toLocaleDateString()}</span>
            : <span className="text-muted-foreground">不过期</span>}
          <Button variant="ghost" size="sm" className="h-6 px-1" title="设节点到期" onClick={editNodeExpiry}><CalendarClock className="w-3 h-3" /></Button>
        </div>
        <span className="text-[11px] text-muted-foreground">命中(超总流量池 / 到期)→ 本节点全部终端下轮断开</span>
      </div>

      {/* 发名额 */}
      <div className="flex items-end gap-3 border rounded-lg p-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">数量(1-50)</label>
          <input type="number" min={1} max={50} value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
            className="border rounded px-2 py-1 w-24" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">备注(可选)</label>
          <input type="text" value={label} placeholder="如 acme 公司"
            onChange={(e) => setLabel(e.target.value)}
            className="border rounded px-2 py-1 w-40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">统一到期(可选)</label>
          <input type="date" value={batchExpiry}
            onChange={(e) => setBatchExpiry(e.target.value)}
            className="border rounded px-2 py-1 w-40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">统一配额 GB(可选)</label>
          <input type="number" min={0} step="0.5" value={batchQuotaGB} placeholder="不限"
            onChange={(e) => setBatchQuotaGB(e.target.value)}
            className="border rounded px-2 py-1 w-28" />
        </div>
        <Button onClick={createSeats} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          发名额
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />加载中…</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>email</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>到期</TableHead>
              <TableHead>并发IP</TableHead>
              <TableHead>配额(月)</TableHead>
              <TableHead>7天流量</TableHead>
              <TableHead>下发</TableHead>
              <TableHead>订阅</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">暂无名额,点上方「发名额」</TableCell></TableRow>
            )}
            {seats.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.email}</TableCell>
                <TableCell>{s.label || '-'}</TableCell>
                <TableCell>
                  <Button variant={s.enabled ? 'default' : 'secondary'} size="sm"
                    onClick={() => patchSeat(s.id, { enabled: !s.enabled })}>
                    {s.enabled ? '启用' : '停用'}
                  </Button>
                </TableCell>
                <TableCell className="text-xs">
                  <button
                    className="inline-flex items-center gap-1 hover:underline"
                    title="设置/修改到期(点击)"
                    onClick={() => editExpiry(s)}
                  >
                    <CalendarClock className="w-3 h-3 text-muted-foreground" />
                    {s.expires_at
                      ? <span className={new Date(s.expires_at) < new Date() ? 'text-red-500' : ''}>{new Date(s.expires_at).toLocaleDateString()}</span>
                      : <span className="text-muted-foreground">不过期</span>}
                  </button>
                </TableCell>
                <TableCell className="text-xs">{s.ip_limit ?? '不限'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <QuotaCell used={s.used_bytes} quota={s.quota_bytes} />
                    <Button variant="ghost" size="sm" className="h-6 px-1" title="设置配额" onClick={() => editQuota(s)}>
                      <Gauge className="w-3 h-3" />
                    </Button>
                  </div>
                  {s.quota_bytes != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {s.over_action === 'alert' ? '仅告警' : s.over_action === 'throttle' ? '限速→停' : '超额停用'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono">{formatBytes(trafficByEmail.get(s.email) ?? 0)}</TableCell>
                <TableCell className="text-xs">
                  {s.last_reconcile_error
                    ? <span className="text-red-500" title={s.last_reconcile_error}>错误</span>
                    : s.last_reconciled_at
                      ? <span className="text-green-600">{new Date(s.last_reconciled_at).toLocaleTimeString()}</span>
                      : <span className="text-muted-foreground">待下发</span>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="sm" className="h-6 justify-start" onClick={() => copySubUrl(s.subscribe_token)}>
                      <Copy className="w-3 h-3 mr-1" />订阅
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 justify-start" disabled={!s.vless_url}
                      title={s.vless_url ?? '节点 base 配置未就绪'} onClick={() => copyVless(s.vless_url)}>
                      <LinkIcon className="w-3 h-3 mr-1" />vless
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {s.quota_bytes != null && (
                      <Button variant="ghost" size="sm" title="重置配额周期(used 归零)" onClick={() => rollPeriod(s)}>
                        <RotateCcw className="w-4 h-4 text-blue-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteSeat(s.id, s.email)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
