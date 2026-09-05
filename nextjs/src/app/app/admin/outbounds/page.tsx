'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Network, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface NodeRow {
  id: string
  name: string
  status: string
  protocol: string | null
  public_ip: string | null
  vps_instance_id: string | null
  outbound_count: number | null
}

export default function OutboundIndexPage() {
  const [rows, setRows] = useState<NodeRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/nodes?size=100&status=active')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '加载节点失败')
      const nodes = (j.data ?? []) as NodeRow[]
      const counts = await Promise.all(nodes.map(async (node) => {
        try {
          const or = await fetch(`/api/v1/admin/nodes/${node.id}/outbounds`)
          const oj = await or.json()
          return or.ok ? (oj.outbounds ?? []).length : null
        } catch { return null }
      }))
      setRows(nodes.map((node, i) => ({ ...node, outbound_count: counts[i] })))
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Network className="w-5 h-5" />
        <h1 className="text-xl font-semibold">Outbound 管理</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />刷新</Button>
      </div>
      <p className="text-sm text-muted-foreground">Outbound 按 VPS Xray runtime 管理。选择一个入口节点，进入资产、路径和 Endpoint 工作台。</p>
      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />加载中…</div> : (
        <Table>
          <TableHeader><TableRow><TableHead>入口节点</TableHead><TableHead>状态</TableHead><TableHead>协议</TableHead><TableHead>地址</TableHead><TableHead>Outbound 数</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((node) => <TableRow key={node.id}>
              <TableCell className="font-medium">{node.name}</TableCell>
              <TableCell>{node.status}</TableCell>
              <TableCell>{node.protocol || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{node.public_ip || '-'}</TableCell>
              <TableCell>{node.outbound_count ?? '无权限'}</TableCell>
              <TableCell><Link href={`/app/admin/nodes/${node.id}/outbounds`}><Button size="sm" variant="outline">打开工作台</Button></Link></TableCell>
            </TableRow>)}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无可管理节点</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
