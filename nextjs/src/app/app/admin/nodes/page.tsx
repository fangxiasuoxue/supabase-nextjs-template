'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { NodeSubscriptionCard } from '@/components/admin/nodes/NodeSubscriptionCard'
import { RegisterExistingNodeDialog } from '@/components/admin/nodes/RegisterExistingNodeDialog'
import { toast } from 'sonner'
import { Loader2, Network, Plus, QrCode, ExternalLink, Rocket, Trash2 } from 'lucide-react'
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

// SDD 55 · P2a:端用户门户的 client(只回端用户字段,不含 node 拓扑)。
interface MyClient {
  id: string
  label: string | null
  email: string | null
  enabled: boolean
  expires_at: string | null
  token: string | null
}

// SDD 55 · P2b:二级代理被授权的 node + 级别。
interface MyNode {
  id: string
  name: string | null
  protocol: string | null
  status: string
  inbound_tag: string | null
  created_at: string
  level: 'read' | 'write' | 'manage'
  vpsOk?: boolean // P3b/R3:该 node 所在 VPS 是否被授权(可重部署);false→打标「⚠ 无 VPS」
}

export default function AdminNodesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bundleToken, setBundleToken] = useState<string | null>(null)
  // SDD 55 · P0:节点生命周期按钮(创建部署/部署历史/登记已有落地)仅 manage 可见。
  // canManage = admin ∨ 模块级 nodes.can_manage(与 AppLayout 同源判定)。
  const [canManage, setCanManage] = useState(false)
  // SDD 55 · P2a:非 manage 用户走「端用户门户」——只看被授权给自己的 client。
  const [roleResolved, setRoleResolved] = useState(false)
  const [myClients, setMyClients] = useState<MyClient[]>([])
  const [myNodes, setMyNodes] = useState<MyNode[]>([])
  const [portalLoading, setPortalLoading] = useState(true)
  // SDD 55 · P2c:门户内 manage 节点的生命周期护栏 —— 是否持有任一 VPS 授权。
  // 无 VPS → 「创建部署」置灰(R1)、删除节点强警告「无法重建」(R2)。
  const [hasVps, setHasVps] = useState(false)

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

  // 门户数据源(二级代理 node + 端用户 client + 自身 VPS 授权),可在删节点后复用刷新。
  const fetchPortal = useCallback(async () => {
    try {
      const [rn, rc, rv] = await Promise.all([
        fetch('/api/v1/me/nodes').then((r) => r.json()).catch(() => ({})),
        fetch('/api/v1/me/clients').then((r) => r.json()).catch(() => ({})),
        fetch('/api/v1/me/vps').then((r) => r.json()).catch(() => ({})),
      ])
      setMyNodes(rn?.nodes ?? [])
      setMyClients(rc?.clients ?? [])
      setHasVps(!!rv?.hasVps)
    } catch { /* 空态兜底 */ } finally { setPortalLoading(false) }
  }, [])

  useEffect(() => {
    (async () => {
      let manage = false
      try {
        const [isAdmin, perms] = await Promise.all([
          checkIsAdmin(),
          getUserPermissionsAction(),
        ])
        manage = isAdmin || (perms || []).some((p: any) => p.module === 'nodes' && p.can_manage)
      } catch { manage = false }
      setCanManage(manage)
      setRoleResolved(true)
      // 非 manage → 取被授权给自己的 node(二级代理)+ client(端用户)+ VPS 授权。
      if (!manage) await fetchPortal()
    })()
  }, [fetchPortal])

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

  // SDD 55 · P2c/R2 —— 门户内二级代理删自己 manage 的节点。强警告;无 VPS 时特别提示无法重建。
  const handlePortalDeleteNode = async (n: MyNode) => {
    if (n.status === 'deleted') return
    const noVpsWarn = hasVps ? '' :
      `\n\n• 🛑 你当前【无 VPS 授权】,删除后【无法重新部署】此节点,可能导致你名下没有可用节点。\n` +
      `  如需保留服务,请先联系管理员为你分配 VPS,或改用「续期/停用」而非删除。`
    if (!window.confirm(
      `确认删除你管理的节点「${n.name ?? n.inbound_tag ?? n.id.slice(0, 8)}」?\n\n` +
      `• 将下发拆除机器上的落地 inbound（${n.inbound_tag ?? '—'}),不可撤销。\n` +
      `• 该节点下的所有终端(名额)订阅将随之失效。` +
      noVpsWarn,
    )) return
    setBusyId(n.id)
    try {
      const res = await fetch(`/api/v1/admin/nodes/${n.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '删除失败')
      toast.success('删除任务已下发(suspended → 拆除后转 deleted)')
      fetchPortal()
    } catch (e: any) { toast.error(e.message) } finally { setBusyId(null) }
  }

  // 角色未定前先不渲染,避免管理员/端用户视图闪切。
  if (!roleResolved) {
    return (
      <div className="flex items-center justify-center h-48 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
      </div>
    )
  }

  // SDD 55 · P2a/P2b:非 manage 用户 —— 二级代理(我管理的节点)+ 端用户(我的订阅)。
  if (!canManage) {
    const seatStatus = (c: MyClient) => {
      if (!c.enabled) return { text: '已停用', cls: 'text-slate-500 bg-slate-50 border-slate-200' }
      if (c.expires_at && new Date(c.expires_at).getTime() < Date.now())
        return { text: '已到期', cls: 'text-red-700 bg-red-50 border-red-200' }
      return { text: '正常', cls: 'text-green-700 bg-green-50 border-green-200' }
    }
    const levelLabel: Record<string, string> = { read: '只读', write: '运营', manage: '管理' }
    const hasNodes = myNodes.length > 0
    const hasClients = myClients.length > 0
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {portalLoading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">加载中...</span>
          </div>
        ) : (!hasNodes && !hasClients) ? (
          <div className="glass-card-premium rounded-[2.5rem] h-48 flex flex-col items-center justify-center gap-4 opacity-40">
            <QrCode className="h-10 w-10" />
            <span className="text-xs font-black uppercase tracking-widest">暂无授权</span>
            <span className="text-[11px] text-muted-foreground">请联系管理员为你分配节点或终端</span>
          </div>
        ) : (
          <>
            {hasNodes && (
              <section className="space-y-4">
                <div>
                  <div className="flex items-center gap-3 text-cyan-600 mb-1">
                    <Network className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">My Nodes</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">我管理的节点</h2>
                  <p className="text-muted-foreground text-sm">你被授权管理的节点;点「管理终端」发名额/续期/配额(级别决定可做的操作)。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myNodes.map((n) => (
                    <div key={n.id} className="glass-card-premium rounded-[2rem] p-6 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-black text-lg truncate">{n.name || n.inbound_tag || n.id.slice(0, 8)}</div>
                          <div className="tech-mono text-[11px] text-muted-foreground/60 truncate">{n.protocol ?? '--'} · {n.inbound_tag ?? '--'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusColor(n.status)}`}>
                            {n.status}
                          </span>
                          <span className="rounded bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 text-[10px] font-black text-cyan-700">{levelLabel[n.level]}</span>
                          {/* P3b/R3:manage 节点但无其所在 VPS 授权 → 不可重部署,打标警示。 */}
                          {n.level === 'manage' && !n.vpsOk && (
                            <span className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] font-black text-amber-700"
                                  title="你无此节点所在 VPS 的授权,删除后无法重新部署">⚠ 无 VPS</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-auto space-y-2">
                        <Link href={`/app/admin/nodes/${n.id}/clients`}>
                          <Button className="w-full rounded-xl h-10 text-xs font-black uppercase tracking-widest">
                            管理终端
                            <ExternalLink className="ml-2 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {/* SDD 55 · P2c:manage 级才见节点生命周期操作(创建部署需 VPS / 删除强警告)。 */}
                        {n.level === 'manage' && (
                          <div className="grid grid-cols-2 gap-2">
                            {hasVps ? (
                              <Link href="/app/admin/nodes/deploy">
                                <Button variant="outline" className="w-full rounded-xl h-9 text-[11px] font-black uppercase tracking-widest border-slate-300">
                                  <Rocket className="mr-1.5 h-3.5 w-3.5" />
                                  创建部署
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                variant="outline" disabled title="无 VPS 授权:请联系管理员分配 VPS 后再创建部署"
                                className="w-full rounded-xl h-9 text-[11px] font-black uppercase tracking-widest border-slate-200 opacity-50 cursor-not-allowed"
                              >
                                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                                无 VPS
                              </Button>
                            )}
                            <Button
                              variant="outline" disabled={busyId === n.id || n.status === 'deleted'}
                              onClick={() => handlePortalDeleteNode(n)}
                              className="w-full rounded-xl h-9 text-[11px] font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              {busyId === n.id ? '…' : '删除'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hasClients && (
              <section className="space-y-4">
                <div>
                  <div className="flex items-center gap-3 text-cyan-600 mb-1">
                    <QrCode className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">My Subscriptions</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">我的订阅</h2>
                  <p className="text-muted-foreground text-sm">你被授权的节点订阅;点「打开」查看二维码与链接,导入客户端即可用。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myClients.map((c) => {
                    const st = seatStatus(c)
                    return (
                      <div key={c.id} className="glass-card-premium rounded-[2rem] p-6 flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="font-black text-lg truncate">{c.label || c.email || '我的节点'}</div>
                            {c.label && c.email && (
                              <div className="tech-mono text-[11px] text-muted-foreground/60 truncate">{c.email}</div>
                            )}
                          </div>
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${st.cls}`}>
                            {st.text}
                          </span>
                        </div>
                        {c.expires_at && (
                          <div className="text-[11px] text-muted-foreground/70">
                            有效期至 {new Date(c.expires_at).toLocaleString('zh-CN')}
                          </div>
                        )}
                        {c.token ? (
                          <Link href={`/s/${c.token}`} target="_blank" className="mt-auto">
                            <Button className="w-full rounded-xl h-10 text-xs font-black uppercase tracking-widest">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              打开(二维码/链接)
                            </Button>
                          </Link>
                        ) : (
                          <div className="mt-auto text-[11px] text-muted-foreground/60">订阅未就绪,请稍后</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    )
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
