'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { NodeSubscriptionCard } from '@/components/admin/nodes/NodeSubscriptionCard'
import { RegisterExistingNodeDialog } from '@/components/admin/nodes/RegisterExistingNodeDialog'
import { toast } from 'sonner'
import { Loader2, Network, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { checkIsAdmin, getUserPermissionsAction } from '@/app/actions/auth'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Node {
  id: string
  name: string | null
  vps_instance_id: string | null
  protocol: string | null
  status: string
  subscribe_token: string | null
  inbound_tag: string | null
  created_at: string
}

export default function AdminNodesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bundleToken, setBundleToken] = useState<string | null>(null)
  // SDD 55 · P0:节点生命周期按钮(创建部署/部署历史/登记已有落地)仅 manage 可见。
  // canManage = admin ∨ 模块级 nodes.can_manage(与 AppLayout 同源判定)。
  const [canManage, setCanManage] = useState(false)

  const fetchNodes = useCallback(async () => {
    try {
      const supabase = await createSPASassClientAuthenticated()
      const client = supabase.getSupabaseClient() as any
      const [{ data, error }, { data: bundle }] = await Promise.all([
        client
          .from('nodes')
          .select('id, name, vps_instance_id, protocol, status, subscribe_token, inbound_tag, created_at')
          .neq('status', 'deleted') // 软删节点默认隐藏(行仍在库供审计)
          .order('created_at', { ascending: false }),
        client
          .from('subscription_bundles')
          .select('token')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])
      if (error) throw error
      setNodes(data || [])
      setBundleToken((bundle as any)?.token ?? null)
    } catch (e: any) {
      toast.error('加载节点列表失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNodes() }, [fetchNodes])

  useEffect(() => {
    (async () => {
      try {
        const [isAdmin, perms] = await Promise.all([
          checkIsAdmin(),
          getUserPermissionsAction(),
        ])
        setCanManage(
          isAdmin ||
          (perms || []).some((p: any) => p.module === 'nodes' && p.can_manage),
        )
      } catch { setCanManage(false) }
    })()
  }, [])

  const statusColor = (s: string) =>
    s === 'active' ? 'text-green-700 bg-green-50 border-green-200'
    : s === 'deploying' ? 'text-blue-700 bg-blue-50 border-blue-200'
    : s === 'suspended' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : s === 'error' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-slate-500 bg-slate-50 border-slate-200'

  const [busyId, setBusyId] = useState<string | null>(null)

  const handleRename = async (node: Node) => {
    const next = window.prompt('新节点名', node.name ?? '')?.trim()
    if (!next || next === node.name) return
    setBusyId(node.id)
    try {
      const res = await fetch(`/api/v1/admin/nodes/${node.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '改名失败')
      toast.success('已改名')
      fetchNodes()
    } catch (e: any) { toast.error(e.message) } finally { setBusyId(null) }
  }

  const handleDelete = async (node: Node) => {
    if (node.status === 'deleted') return
    if (!window.confirm(
      `确认删除节点「${node.name ?? node.id.slice(0, 8)}」?\n\n` +
      `• 将下发拆除机器上的落地 inbound（${node.inbound_tag ?? '—'}），不可撤销。\n` +
      `• ⚠️ 若该落地已被网关（gw-01/02/03 的 usNbare/pcs_40XX）引用，删除会导致对应出口失效。\n` +
      `  生产在用的落地（如 us7/4007）删除前务必确认无依赖。`,
    )) return
    setBusyId(node.id)
    try {
      const res = await fetch(`/api/v1/admin/nodes/${node.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '删除失败')
      toast.success('删除任务已下发(suspended → 拆除后转 deleted)')
      fetchNodes()
    } catch (e: any) { toast.error(e.message) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 text-cyan-600 mb-1">
            <Network className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">Node Management</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">节点管理</h2>
          <p className="text-muted-foreground text-sm">管理所有已部署节点与订阅信息</p>
        </div>
        {canManage && (
          <div className="flex gap-3">
            <RegisterExistingNodeDialog onRegistered={fetchNodes} />
            <Link href="/app/admin/nodes/deployments">
              <Button variant="outline" className="border-slate-300 hover:bg-slate-50 rounded-xl h-10 text-xs font-black uppercase tracking-widest">
                部署历史
              </Button>
            </Link>
            <Link href="/app/admin/nodes/deploy">
              <Button className="rounded-xl h-10 text-xs font-black uppercase tracking-widest">
                <Plus className="mr-2 h-3.5 w-3.5" />
                创建部署
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 聚合订阅:一个地址含所有 active 节点 */}
      {bundleToken && (
        <NodeSubscriptionCard
          token={bundleToken}
          pathPrefix="/sub/bundle"
          heading="聚合订阅 · 全部活跃节点"
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
        </div>
      ) : (
        <div className="glass-card-premium rounded-[2.5rem] overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-transparent h-14">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pl-8">节点 ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">协议</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">状态</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Inbound Tag</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">创建时间</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] text-right">订阅</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pr-8 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                      <Network className="h-10 w-10" />
                      <span className="text-xs font-black uppercase tracking-widest">暂无节点</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : nodes.map((node) => (
                <Fragment key={node.id}>
                  <TableRow className="border-slate-200 hover:bg-slate-50 h-16 group/row">
                    <TableCell className="pl-8">
                      <span className="tech-mono text-xs text-muted-foreground/70">{node.id.slice(0, 12)}...</span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 border border-sky-200 text-[9px] font-black uppercase text-sky-800">
                        {node.protocol ?? '--'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusColor(node.status)}`}>
                        {node.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tech-mono text-xs text-muted-foreground/60">{node.inbound_tag ?? '--'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground/50">{new Date(node.created_at).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {node.subscribe_token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          {expandedId === node.id ? '收起' : '订阅链接'}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/app/admin/nodes/${node.id}/clients`}>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-cyan-50 hover:text-cyan-700"
                          >终端</Button>
                        </Link>
                        <Button
                          variant="ghost" size="sm" disabled={busyId === node.id || node.status === 'deleted'}
                          onClick={() => handleRename(node)}
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100"
                        >改名</Button>
                        <Button
                          variant="ghost" size="sm" disabled={busyId === node.id || node.status === 'deleted'}
                          onClick={() => handleDelete(node)}
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 hover:text-red-700"
                        >{busyId === node.id ? '…' : '删除'}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === node.id && (
                    <TableRow key={`${node.id}-sub`} className="border-slate-200 bg-slate-50">
                      <TableCell colSpan={7} className="px-8 pb-4">
                        <NodeSubscriptionCard
                          token={node.subscribe_token}
                          protocol={node.protocol ?? undefined}
                          inboundTag={node.inbound_tag ?? undefined}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
