'use client'

import { use as usePromise, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, Loader2, Network, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
interface ManagedNode { id: string; name: string; public_ip: string | null; port: number | null; last_deployed_at: string | null }
interface CheapIp { id: number; provider: string; remark: string | null; label: string | null; status: string | null; country_code: string | null; expires_at: string | null }

export default function NodeOutboundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [outbounds, setOutbounds] = useState<Outbound[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [items, setItems] = useState<Item[]>([])
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/admin/nodes/${id}/clients`}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />返回 Clients</Button></Link>
        <h1 className="text-xl font-semibold">Outbound 资产与路径</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />刷新</Button>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        保存/导入只修改期望态，不会立即改变客户线路；实际写入 Xray 必须经过 Plan → Apply → 验证。
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Network className="w-4 h-4" />当前 VPS Outbounds（{outbounds.length}）</h2>
        <Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>tag</TableHead><TableHead>Endpoint</TableHead><TableHead>路径</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
          <TableBody>{outbounds.map((o) => <TableRow key={o.id}><TableCell>{o.display_name}</TableCell><TableCell className="font-mono text-xs">{o.tag}</TableCell><TableCell>{o.endpoint_kind}</TableCell><TableCell>{o.transport_kind}</TableCell><TableCell title={o.last_error || ''}>{o.deploy_state}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">从自建标准节点创建 Outbound</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">源节点<select className="block mt-1 border rounded px-2 py-1 min-w-48" value={managedNodeId} onChange={(e) => chooseNode(e.target.value)}><option value="">请选择</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.name} · {n.public_ip || '无域名'}</option>)}</select></label>
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
        <h2 className="font-semibold">Source 目录（{sources.length}）</h2>
        <Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>密管</TableHead><TableHead>发现项</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>{sources.map((s) => <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.kind}</TableCell><TableCell>{s.has_secret ? `${s.secret_ref_scheme}://***` : '-'}</TableCell><TableCell>{itemCount.get(s.id) ?? 0}</TableCell><TableCell title={s.last_error || ''}>{s.status}</TableCell><TableCell>{s.kind === 'subscription' && <Button variant="outline" size="sm" disabled={busy === s.id} onClick={() => discover(s.id)}>{busy === s.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Discover</Button>}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      {items.length > 0 && <section className="space-y-3"><h2 className="font-semibold">已发现 Endpoint（{items.length}）</h2><Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>协议</TableHead><TableHead>服务器</TableHead><TableHead>兼容性</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{items.map((x) => <TableRow key={x.id}><TableCell>{x.display_name}</TableCell><TableCell>{x.protocol}</TableCell><TableCell className="font-mono text-xs">{x.server_hint || '-'}{x.port_hint ? `:${x.port_hint}` : ''}</TableCell><TableCell className={x.compatibility === 'supported' ? 'text-green-600' : 'text-amber-600'}>{x.compatibility}</TableCell><TableCell>{x.status}</TableCell></TableRow>)}</TableBody></Table></section>}
    </div>
  )
}
