'use client'

// 中转加速总览(Transit Acceleration)—— SDD 60。
// 声明式管理:通道(L2 供给)× 落地(reality/cheap)± 聚合 → GoRelay 隧道 + gw 消费口。
// 镜像 app/domain/page.tsx:client 组件 + createSPASassClientAuthenticated 直读 + shared Table;
// 写/下发走 /api/v1/admin/transit/*(编排引擎)。仅 admin。

import { useState, useEffect, useCallback } from 'react'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'
import { checkIsAdmin } from '@/app/actions/auth'
import { toast } from 'sonner'
import { Loader2, Zap, RefreshCw, Play, Activity, Terminal } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  TransitChannel, TransitAggPoint, TransitTunnel, TransitBinding, ReconcileResult, PROVIDER_META,
} from '@/types/transit'

async function apiCall(path: string, method = 'POST'): Promise<any> {
  const r = await fetch(`/api/v1/admin/transit${path}`, { method })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
  return j
}

export default function TransitOverviewPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<TransitChannel[]>([])
  const [aggPoints, setAggPoints] = useState<TransitAggPoint[]>([])
  const [tunnels, setTunnels] = useState<TransitTunnel[]>([])
  const [bindings, setBindings] = useState<TransitBinding[]>([])
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const admin = await checkIsAdmin()
      setIsAdmin(admin)
      if (!admin) return
      const c = (await createSPASassClientAuthenticated()).getSupabaseClient() as any
      const [ch, ap, tn, bd] = await Promise.all([
        c.from('transit_channel').select('*').order('created_at', { ascending: false }),
        c.from('transit_agg_point').select('*').order('region'),
        c.from('transit_tunnel').select('*').order('listen_port'),
        c.from('transit_binding').select('*').order('gw').order('consume_port'),
      ])
      setChannels(ch.data ?? [])
      setAggPoints(ap.data ?? [])
      setTunnels(tn.data ?? [])
      setBindings(bd.data ?? [])
    } catch (e: any) {
      toast.error('加载失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }

  const doReconcile = () => run('reconcile', async () => {
    const j = await apiCall('/reconcile', 'GET')
    setReconcile(j.data)
    toast.success(`对账:缺失 ${j.data.missing.length} / 孤儿 ${j.data.orphan.length}`)
  })
  const syncAgg = (id: string) => run('agg:' + id, async () => {
    const j = await apiCall(`/agg-points/${id}/sync`)
    toast.success(`聚合点下发:inbound ${j.data.inbound} · 出站 ${j.data.outbounds} · 路由 ${j.data.routes} · persist ${j.data.persist}`)
  })
  const syncTunnel = (id: string) => run('tn:' + id, async () => {
    const j = await apiCall(`/tunnels/${id}/sync`)
    toast.success(`隧道已同步:gorelay id=${j.data.gorelay_tunnel_id}`)
    fetchAll()
  })
  const testTunnel = (id: string) => run('test:' + id, async () => {
    await apiCall(`/tunnels/${id}/test`, 'GET')
    toast.success('隧道 /test 已返回(见网络面板)')
  })
  const genUci = (gw: string) => run('uci:' + gw, async () => {
    const r = await fetch(`/api/v1/admin/transit/gw/${gw}/uci`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const script = await r.text()
    await navigator.clipboard.writeText(script).catch(() => {})
    toast.success(`${gw} uci 脚本已生成(已复制到剪贴板,${script.split('\n').length} 行)`)
  })

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (isAdmin === false) return <div className="p-8 text-red-600">仅 admin 可访问中转加速。</div>

  const gws = Array.from(new Set(bindings.map((b) => b.gw))).sort()

  return (
    <div className="space-y-8 p-2">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-sky-600 flex items-center gap-1"><Zap className="w-3 h-3" /> Transit Acceleration</div>
          <h1 className="text-2xl font-semibold">中转加速</h1>
          <p className="text-sm text-gray-500">通道 × 落地(±聚合)→ GoRelay 隧道 + gw 消费口。声明式编排,对账收敛。</p>
        </div>
        <button onClick={doReconcile} disabled={busy === 'reconcile'} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          {busy === 'reconcile' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 对账现网
        </button>
      </header>

      {reconcile && (
        <div className={`rounded-md border px-4 py-2 text-sm ${reconcile.missing.length || reconcile.orphan.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          对账:{reconcile.missing.length ? <>缺失(需 sync):<b>{reconcile.missing.join(', ')}</b>；</> : '无缺失；'}
          {reconcile.orphan.length ? <>现网孤儿(未声明):<b>{reconcile.orphan.join(', ')}</b></> : '无孤儿'}
        </div>
      )}

      {/* 通道 */}
      <section>
        <h2 className="text-lg font-medium mb-2">通道(L2 中转供给)</h2>
        <Table>
          <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>供给</TableHead><TableHead>线路id</TableHead><TableHead>倍率</TableHead><TableHead>档</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
          <TableBody>
            {channels.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded border ${PROVIDER_META[c.provider]?.cls}`}>{PROVIDER_META[c.provider]?.label ?? c.provider}</span></TableCell>
                <TableCell>{c.in_node_group_id ?? '—'}</TableCell>
                <TableCell>{c.traffic_rate != null ? `×${c.traffic_rate}` : '—'}</TableCell>
                <TableCell>{c.level ?? '—'}</TableCell>
                <TableCell>{c.status}</TableCell>
              </TableRow>
            ))}
            {!channels.length && <TableRow><TableCell colSpan={6} className="text-gray-400">暂无通道</TableCell></TableRow>}
          </TableBody>
        </Table>
      </section>

      {/* 聚合点 */}
      <section>
        <h2 className="text-lg font-medium mb-2">聚合点(1 隧道扇出 N cheap)</h2>
        <Table>
          <TableHeader><TableRow><TableHead>region</TableHead><TableHead>vps</TableHead><TableHead>入站口</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {aggPoints.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.region ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{a.vps_instance_id.slice(0, 8)}</TableCell>
                <TableCell>{a.inbound_tag}:{a.listen_port}</TableCell>
                <TableCell>{a.status}</TableCell>
                <TableCell><button onClick={() => syncAgg(a.id)} disabled={busy === 'agg:' + a.id} className="inline-flex items-center gap-1 text-sky-600 hover:underline text-sm">{busy === 'agg:' + a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} 下发 xray</button></TableCell>
              </TableRow>
            ))}
            {!aggPoints.length && <TableRow><TableCell colSpan={5} className="text-gray-400">暂无聚合点</TableCell></TableRow>}
          </TableBody>
        </Table>
      </section>

      {/* 隧道 */}
      <section>
        <h2 className="text-lg font-medium mb-2">GoRelay 隧道</h2>
        <Table>
          <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>本地口</TableHead><TableHead>模式</TableHead><TableHead>forward</TableHead><TableHead>现网id</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {tunnels.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name ?? '—'}</TableCell>
                <TableCell className="font-mono">{t.listen_port}</TableCell>
                <TableCell>{t.mode}</TableCell>
                <TableCell className="text-xs">{(t.forward_spec ?? []).map((f) => f.address).join(', ') || '—'}</TableCell>
                <TableCell>{t.gorelay_tunnel_id ?? <span className="text-amber-600">未同步</span>}</TableCell>
                <TableCell className="space-x-3">
                  <button onClick={() => syncTunnel(t.id)} disabled={busy === 'tn:' + t.id} className="inline-flex items-center gap-1 text-sky-600 hover:underline text-sm">{busy === 'tn:' + t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} 同步</button>
                  {t.gorelay_tunnel_id && <button onClick={() => testTunnel(t.id)} disabled={busy === 'test:' + t.id} className="inline-flex items-center gap-1 text-gray-600 hover:underline text-sm"><Activity className="w-3 h-3" /> test</button>}
                </TableCell>
              </TableRow>
            ))}
            {!tunnels.length && <TableRow><TableCell colSpan={6} className="text-gray-400">暂无隧道</TableCell></TableRow>}
          </TableBody>
        </Table>
      </section>

      {/* gw 消费口 */}
      <section>
        <h2 className="text-lg font-medium mb-2">gw 消费口(免认证 LAN socks)</h2>
        {gws.map((gw) => (
          <div key={gw} className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">{gw}</h3>
              <button onClick={() => genUci(gw)} disabled={busy === 'uci:' + gw} className="inline-flex items-center gap-1 text-sky-600 hover:underline text-sm">{busy === 'uci:' + gw ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />} 生成 uci</button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>消费口</TableHead><TableHead>类型</TableHead><TableHead>落地</TableHead><TableHead>agg用户</TableHead><TableHead>node</TableHead></TableRow></TableHeader>
              <TableBody>
                {bindings.filter((b) => b.gw === gw).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.consume_port}</TableCell>
                    <TableCell>{b.landing_kind}</TableCell>
                    <TableCell>{b.landing_ref ?? '—'}</TableCell>
                    <TableCell>{b.agg_user ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{b.node_name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        {!gws.length && <div className="text-gray-400 text-sm">暂无消费口</div>}
      </section>
    </div>
  )
}
