// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { NodeSubscriptionCard } from '@/components/admin/nodes/NodeSubscriptionCard'
import { toast } from 'sonner'
import { Loader2, Network, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Node {
  id: string
  vps_id: string | null
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

  const fetchNodes = useCallback(async () => {
    try {
      const supabase = await createSPASassClientAuthenticated()
      const client = supabase.getSupabaseClient() as any
      const { data, error } = await client
        .from('nodes')
        .select('id, vps_id, protocol, status, subscribe_token, inbound_tag, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setNodes(data || [])
    } catch (e: any) {
      toast.error('加载节点列表失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNodes() }, [fetchNodes])

  const statusColor = (s: string) =>
    s === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20'
    : s === 'deploying' ? 'text-blue-400 bg-blue-500/10 border-blue-400/20'
    : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 text-primary mb-1">
            <Network className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/70">Node Management</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">节点管理</h2>
          <p className="text-muted-foreground text-sm">管理所有已部署节点与订阅信息</p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/admin/nodes/deployments">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-10 text-xs font-black uppercase tracking-widest">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
        </div>
      ) : (
        <div className="glass-card-premium rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5 hover:bg-transparent h-14">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pl-8">节点 ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">协议</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">状态</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Inbound Tag</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">创建时间</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pr-8 text-right">订阅</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                      <Network className="h-10 w-10" />
                      <span className="text-xs font-black uppercase tracking-widest">暂无节点</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : nodes.map((node) => (
                <>
                  <TableRow key={node.id} className="border-white/5 hover:bg-white/[0.02] h-16 group/row">
                    <TableCell className="pl-8">
                      <span className="tech-mono text-xs text-muted-foreground/70">{node.id.slice(0, 12)}...</span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black uppercase text-primary">
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
                    <TableCell className="text-right pr-8">
                      {node.subscribe_token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary"
                        >
                          {expandedId === node.id ? '收起' : '订阅链接'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === node.id && (
                    <TableRow key={`${node.id}-sub`} className="border-white/5 bg-white/[0.01]">
                      <TableCell colSpan={6} className="px-8 pb-4">
                        <NodeSubscriptionCard
                          token={node.subscribe_token}
                          protocol={node.protocol ?? undefined}
                          inboundTag={node.inbound_tag ?? undefined}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
