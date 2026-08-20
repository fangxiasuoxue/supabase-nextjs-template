'use client'

// 节点终端(seat)管理页 —— 发名额 / 启停 / 续期 / 限并发 / 删除 / 每终端订阅。
// 设计依据:docs/current/51 §11.4。走 /api/v1/admin/nodes/[id]/clients 与 /api/v1/admin/clients/[id]。

import { useState, useEffect, useCallback, use as usePromise } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Copy, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

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
  used_bytes: number | null
  created_at: string
}

export default function NodeClientsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/clients`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '加载失败')
      setSeats(j.clients ?? [])
    } catch (e: any) {
      toast.error(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const createSeats = async () => {
    setCreating(true)
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, label: label || null }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '发名额失败')
      toast.success(`已发 ${j.created?.length ?? 0} 个名额`)
      setLabel('')
      setCount(1)
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/admin/nodes"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />返回节点</Button></Link>
        <h1 className="text-xl font-semibold">节点终端(名额)管理</h1>
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
            className="border rounded px-2 py-1 w-48" />
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
              <TableHead>下发</TableHead>
              <TableHead>订阅</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">暂无名额,点上方「发名额」</TableCell></TableRow>
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
                <TableCell className="text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleString() : '不过期'}</TableCell>
                <TableCell className="text-xs">{s.ip_limit ?? '不限'}</TableCell>
                <TableCell className="text-xs">
                  {s.last_reconcile_error
                    ? <span className="text-red-500" title={s.last_reconcile_error}>错误</span>
                    : s.last_reconciled_at
                      ? <span className="text-green-600">{new Date(s.last_reconciled_at).toLocaleTimeString()}</span>
                      : <span className="text-muted-foreground">待下发</span>}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => copySubUrl(s.subscribe_token)}>
                    <Copy className="w-3 h-3 mr-1" />复制
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteSeat(s.id, s.email)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
