'use client'

import { use as usePromise, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, Loader2, Network, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Outbound {
  id: string; tag: string; display_name: string; endpoint_kind: string; transport_kind: string
  deploy_state: string; last_observed_at: string | null; last_error: string | null
}
interface Source {
  id: string; name: string; kind: string; provider: string | null; status: string
  has_secret: boolean; secret_ref_scheme: string | null; last_discovered_at: string | null; last_error: string | null
}
interface Item {
  id: string; source_id: string; display_name: string; protocol: string; server_hint: string | null
  port_hint: number | null; compatibility: string; status: string
}
interface ManagedNode { id: string; name: string; protocol: string | null; public_ip: string | null; port: number | null; last_deployed_at: string | null }
interface CheapIp { id: number; provider: string; remark: string | null; label: string | null; status: string | null; country_code: string | null; expires_at: string | null }

export default function NodeOutboundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [outbounds, setOutbounds] = useState<Outbound[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedOutbounds, setSelectedOutbounds] = useState<Set<string>>(new Set())
  const [planRunId, setPlanRunId] = useState('')
  const [applyRunId, setApplyRunId] = useState('')
  const [nodes, setNodes] = useState<ManagedNode[]>([])
  const [cheapIps, setCheapIps] = useState<CheapIp[]>([])
  const [managedNodeId, setManagedNodeId] = useState('')
  const [managedName, setManagedName] = useState('')
  const [managedTag, setManagedTag] = useState('')
  const [transport, setTransport] = useState('direct')
  const [cheapIpId, setCheapIpId] = useState('')
  const [cheapName, setCheapName] = useState('')
  const [cheapTag, setCheapTag] = useState('')
  const [cheapTransport, setCheapTransport] = useState('direct')
  const [cheapLocalPort, setCheapLocalPort] = useState('')
  const [subName, setSubName] = useState('')
  const [subRef, setSubRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [or, sr] = await Promise.all([
        fetch(`/api/v1/admin/nodes/${id}/outbounds`),
        fetch(`/api/v1/admin/outbound-sources?node_id=${encodeURIComponent(id)}`),
      ])
      const [oj, sj] = await Promise.all([or.json(), sr.json()])
      if (!or.ok) throw new Error(oj.error || '加载 outbound 失败')
      if (!sr.ok) throw new Error(sj.error || '加载 source 失败')
      setOutbounds(oj.outbounds ?? [])
      setSources(sj.sources ?? [])
      setItems(sj.items ?? [])
      setNodes(sj.candidates?.managed_nodes ?? [])
      setCheapIps(sj.candidates?.cheap_ips ?? [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const itemCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const item of items) m.set(item.source_id, (m.get(item.source_id) ?? 0) + 1)
    return m
  }, [items])
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const importableSubscriptionItems = items.filter((x) => sourceById.get(x.source_id)?.kind === 'subscription' && x.compatibility === 'supported' && x.status === 'active')

  const chooseNode = (nodeId: string) => {
    setManagedNodeId(nodeId)
    const n = nodes.find((x) => x.id === nodeId)
    if (!n) return
    const slug = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setManagedName(n.name)
    setManagedTag(`land-${slug}`.slice(0, 200))
  }

  const importManaged = async () => {
    if (!managedNodeId || !managedName || !managedTag) return toast.error('请选择节点并填写名称/tag')
    setBusy('managed')
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/outbounds`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_managed_node', source_node_id: managedNodeId, display_name: managedName, tag: managedTag, transport_kind: transport }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '导入失败')
      toast.success('已登记为 outbound 期望态；应用到 Xray 需走 Apply')
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const chooseCheap = (value: string) => {
    setCheapIpId(value)
    const ip = cheapIps.find((x) => String(x.id) === value)
    if (!ip) return
    const base = ip.remark || ip.label || `cheap-${ip.id}`
    setCheapName(base)
    setCheapTag(`cheap-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+$/g, '').slice(0, 200))
  }

  const importCheap = async () => {
    if (!cheapIpId || !cheapName || !cheapTag) return toast.error('请选择 Cheap IP 并填写名称/tag')
    setBusy('cheap')
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/outbounds`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_cheap_ip', ip_asset_id: Number(cheapIpId), display_name: cheapName, tag: cheapTag, transport_kind: cheapTransport, local_port: cheapLocalPort || null }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '导入失败')
      toast.success('Cheap IP 已登记为 outbound 期望态')
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const createSubscription = async () => {
    if (!subName || !subRef) return toast.error('名称和密钥引用必填')
    setBusy('subscription')
    try {
      const r = await fetch('/api/v1/admin/outbound-sources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: id, kind: 'subscription', name: subName, secret_ref: subRef }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '创建失败')
      toast.success('订阅 Source 已登记；未保存原始 URL')
      setSubName(''); setSubRef('')
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const importSubscriptionItems = async () => {
    if (!selectedItems.size) return toast.error('请先选择可部署的 Endpoint')
    setBusy('import-items')
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/outbounds`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_subscription_items', source_item_ids: Array.from(selectedItems) }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '导入失败')
      toast.success(`已导入 ${j.imported?.length ?? 0} 个 Outbound${j.skipped ? `，跳过 ${j.skipped} 个` : ''}`)
      setSelectedItems(new Set())
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelectedItems((old) => {
      const next = new Set(old)
      if (checked) next.add(itemId); else next.delete(itemId)
      return next
    })
  }

  const runLifecycle = async (mode: 'plan' | 'apply' | 'verify' | 'rollback') => {
    if (mode !== 'rollback' && !selectedOutbounds.size) return toast.error('请先选择出口')
    if (mode === 'apply' && !planRunId) return toast.error('请先执行 Plan')
    if (mode === 'rollback' && !applyRunId) return toast.error('没有可回滚的 Apply')
    setBusy(`lifecycle-${mode}`)
    try {
      const r = await fetch(`/api/v1/admin/nodes/${id}/outbounds/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, outbound_ids: Array.from(selectedOutbounds), plan_run_id: planRunId, apply_run_id: applyRunId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `${mode} 失败`)
      if (mode === 'plan') { setPlanRunId(j.run_id); setApplyRunId(''); j.warning ? toast.warning(j.warning) : toast.success(`Plan 完成：${j.actions?.filter((x: any) => x.kind === 'create').length || 0} 个新增`) }
      if (mode === 'apply') { setApplyRunId(j.run_id); toast.success('Apply 与结构验证成功，出口已激活') }
      if (mode === 'verify') toast.success('Verify 成功：运行态配置与 Client routing 一致')
      if (mode === 'rollback') { setApplyRunId(''); setPlanRunId(''); toast.success('已回滚本次新增出口') }
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const discover = async (sourceId: string) => {
    setBusy(sourceId)
    try {
      const r = await fetch(`/api/v1/admin/outbound-sources/${sourceId}/discover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_id: id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '发现失败')
      toast.success(`发现 ${j.discovered} 个节点，可部署 ${j.supported} 个`)
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const deleteSource = async (source: Source) => {
    if (!window.confirm(`确定删除 Source“${source.name}”及其未被引用的 Endpoint？此操作不可恢复。`)) return
    const busyKey = `delete-source-${source.id}`
    setBusy(busyKey)
    try {
      const r = await fetch(`/api/v1/admin/outbound-sources/${source.id}?node_id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '删除 Source 失败')
      toast.success('Source 已删除')
      setSelectedItems(new Set())
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  const deleteEndpoint = async (item: Item) => {
    if (!window.confirm(`确定删除 Endpoint“${item.display_name}”？此操作不可恢复。`)) return
    const busyKey = `delete-item-${item.id}`
    setBusy(busyKey)
    try {
      const r = await fetch(`/api/v1/admin/outbound-source-items/${item.id}?node_id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '删除 Endpoint 失败')
      toast.success('Endpoint 已删除')
      setSelectedItems((old) => { const next = new Set(old); next.delete(item.id); return next })
      await load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/admin/nodes/${id}/clients`}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />返回 Clients</Button></Link>
        <h1 className="text-xl font-semibold">出口资产与路径</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />刷新</Button>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        保存/导入只修改期望态，不会立即改变客户线路；实际写入 Xray 必须经过 Plan → Apply → 验证。
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold flex items-center gap-2"><Network className="w-4 h-4" />当前 VPS 出口（{outbounds.length}）</h2>
          <Button size="sm" variant="outline" disabled={!selectedOutbounds.size || busy.startsWith('lifecycle-')} onClick={() => runLifecycle('plan')}>Plan</Button>
          <Button size="sm" disabled={!planRunId || busy.startsWith('lifecycle-')} onClick={() => runLifecycle('apply')}>Apply</Button>
          <Button size="sm" variant="outline" disabled={!selectedOutbounds.size || busy.startsWith('lifecycle-')} onClick={() => runLifecycle('verify')}>Verify</Button>
          <Button size="sm" variant="destructive" disabled={!applyRunId || busy.startsWith('lifecycle-')} onClick={() => runLifecycle('rollback')}>Rollback</Button>
          {busy.startsWith('lifecycle-') && <Loader2 className="w-4 h-4 animate-spin" />}
          <span className="text-xs text-muted-foreground">Apply 必须引用当前 Plan；首版只新增、不覆盖同名不同配置。</span>
        </div>
        <Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={outbounds.length > 0 && outbounds.every(o => selectedOutbounds.has(o.id))} onCheckedChange={(checked) => setSelectedOutbounds(checked ? new Set(outbounds.map(o => o.id)) : new Set())} /></TableHead><TableHead>名称</TableHead><TableHead>tag</TableHead><TableHead>Endpoint</TableHead><TableHead>路径</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
          <TableBody>{outbounds.map((o) => <TableRow key={o.id}><TableCell><Checkbox checked={selectedOutbounds.has(o.id)} onCheckedChange={(checked) => setSelectedOutbounds(old => { const next = new Set(old); checked ? next.add(o.id) : next.delete(o.id); return next })} /></TableCell><TableCell>{o.display_name}</TableCell><TableCell className="font-mono text-xs">{o.tag}</TableCell><TableCell>{o.endpoint_kind}</TableCell><TableCell>{o.transport_kind}</TableCell><TableCell title={o.last_error || ''}>{o.deploy_state}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">从自建 VLESS :443 节点创建出口</h2>
        <p className="text-xs text-muted-foreground">仅使用专门的“内部专用 · 出口落地 443”Client；不会复用 1433 等业务入口或普通用户 Client。</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">源节点<select className="block mt-1 border rounded px-2 py-1 min-w-48" value={managedNodeId} onChange={(e) => chooseNode(e.target.value)}><option value="">请选择</option>{nodes.filter((n) => n.protocol?.toLowerCase() === 'vless' && Number(n.port) === 443).map((n) => <option key={n.id} value={n.id}>{n.name} · {n.public_ip || '无域名'}:443</option>)}</select></label>
          <label className="text-xs">显示名称<input className="block mt-1 border rounded px-2 py-1" value={managedName} onChange={(e) => setManagedName(e.target.value)} /></label>
          <label className="text-xs">Xray tag<input className="block mt-1 border rounded px-2 py-1 font-mono" value={managedTag} onChange={(e) => setManagedTag(e.target.value)} /></label>
          <label className="text-xs">路径<select className="block mt-1 border rounded px-2 py-1" value={transport} onChange={(e) => setTransport(e.target.value)}><option value="direct">direct</option><option value="gorelay">gorelay</option><option value="self_transit">self_transit</option></select></label>
          <Button onClick={importManaged} disabled={busy === 'managed'}>{busy === 'managed' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}导入</Button>
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">从 Cheap IP 创建 Outbound</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">IP 资产<select className="block mt-1 border rounded px-2 py-1 min-w-52" value={cheapIpId} onChange={(e) => chooseCheap(e.target.value)}><option value="">请选择 active IP</option>{cheapIps.filter((x) => String(x.status || '').toLowerCase() === 'active').map((x) => <option key={x.id} value={x.id}>{x.remark || x.label || `#${x.id}`} · {x.provider}</option>)}</select></label>
          <label className="text-xs">显示名称<input className="block mt-1 border rounded px-2 py-1" value={cheapName} onChange={(e) => setCheapName(e.target.value)} /></label>
          <label className="text-xs">Xray tag<input className="block mt-1 border rounded px-2 py-1 font-mono" value={cheapTag} onChange={(e) => setCheapTag(e.target.value)} /></label>
          <label className="text-xs">路径<select className="block mt-1 border rounded px-2 py-1" value={cheapTransport} onChange={(e) => setCheapTransport(e.target.value)}><option value="direct">direct</option><option value="gorelay">gorelay</option><option value="self_transit">self_transit</option></select></label>
          {cheapTransport !== 'direct' && <label className="text-xs">本机端口<input type="number" min={1} max={65535} className="block mt-1 border rounded px-2 py-1 w-28" placeholder="3101" value={cheapLocalPort} onChange={(e) => setCheapLocalPort(e.target.value)} /></label>}
          <Button onClick={importCheap} disabled={busy === 'cheap'}>{busy === 'cheap' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}导入</Button>
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">登记第三方订阅</h2>
        <p className="text-xs text-muted-foreground">这里只填写密钥引用，禁止粘贴真实订阅 URL。当前 Discover executor 支持 env://。</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">名称<input className="block mt-1 border rounded px-2 py-1" placeholder="如 白月光" value={subName} onChange={(e) => setSubName(e.target.value)} /></label>
          <label className="text-xs">Secret reference<input className="block mt-1 border rounded px-2 py-1 font-mono min-w-72" placeholder="env://OUTBOUND_SUB_VENDOR_A" value={subRef} onChange={(e) => setSubRef(e.target.value)} /></label>
          <Button onClick={createSubscription} disabled={busy === 'subscription'}><Database className="w-4 h-4 mr-1" />登记 Source</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">订阅源（{sources.length}）</h2>
        <Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>密管</TableHead><TableHead>发现项</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>{sources.map((s) => <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.kind}</TableCell><TableCell>{s.has_secret ? `${s.secret_ref_scheme}://***` : '-'}</TableCell><TableCell>{itemCount.get(s.id) ?? 0}</TableCell><TableCell title={s.last_error || ''}>{s.status}</TableCell><TableCell><div className="flex gap-2">{s.kind === 'subscription' && <Button variant="outline" size="sm" disabled={busy === s.id} onClick={() => discover(s.id)}>{busy === s.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Discover</Button>}<Button variant="destructive" size="sm" disabled={busy === `delete-source-${s.id}`} onClick={() => deleteSource(s)}>{busy === `delete-source-${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}<span className="ml-1">删除</span></Button></div></TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      {items.length > 0 && <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">出口端点（{items.length}）</h2>
          <Button size="sm" onClick={importSubscriptionItems} disabled={!selectedItems.size || busy === 'import-items'}>
            {busy === 'import-items' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            导入选中到出口（{selectedItems.size}）
          </Button>
          <span className="text-xs text-muted-foreground">导入后即可在创建 Client/出口下拉中选择；首次为 draft，需 Apply 后才实际生效。</span>
        </div>
        <Table><TableHeader><TableRow>
          <TableHead className="w-10"><Checkbox
            checked={importableSubscriptionItems.length > 0 && importableSubscriptionItems.every((x) => selectedItems.has(x.id))}
            onCheckedChange={(checked) => setSelectedItems(checked ? new Set(importableSubscriptionItems.map((x) => x.id)) : new Set())}
          /></TableHead>
          <TableHead>名称</TableHead><TableHead>来源</TableHead><TableHead>协议</TableHead><TableHead>服务器</TableHead><TableHead>兼容性</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead>
        </TableRow></TableHeader><TableBody>{items.map((x) => {
          const selectable = sourceById.get(x.source_id)?.kind === 'subscription' && x.compatibility === 'supported' && x.status === 'active'
          return <TableRow key={x.id}>
            <TableCell><Checkbox disabled={!selectable} checked={selectedItems.has(x.id)} onCheckedChange={(checked) => toggleItem(x.id, checked === true)} /></TableCell>
            <TableCell>{x.display_name}</TableCell><TableCell>{sourceById.get(x.source_id)?.name || '-'}</TableCell><TableCell>{x.protocol}</TableCell>
            <TableCell className="font-mono text-xs">{x.server_hint || '-'}{x.port_hint ? `:${x.port_hint}` : ''}</TableCell>
            <TableCell className={x.compatibility === 'supported' ? 'text-green-600' : 'text-amber-600'}>{x.compatibility}</TableCell><TableCell>{x.status}</TableCell>
            <TableCell><Button variant="destructive" size="sm" disabled={busy === `delete-item-${x.id}`} onClick={() => deleteEndpoint(x)}>{busy === `delete-item-${x.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}<span className="ml-1">删除</span></Button></TableCell>
          </TableRow>
        })}</TableBody></Table>
      </section>}
    </div>
  )
}
