'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Loader2, Activity } from 'lucide-react'

interface MetricPoint {
  instance_id: string
  recorded_at: string
  cpu_percent: number | null
  mem_percent: number | null
  disk_percent: number | null
}

interface Props {
  instanceId: string
  /** 时间窗(小时),默认 24 */
  hours?: number
}

export function VpsMetricsTrend({ instanceId, hours = 24 }: Props) {
  const [data, setData] = useState<MetricPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/v1/admin/vps/${instanceId}/metrics?hours=${hours}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) {
          setError(json.error)
          setData(null)
        } else {
          setData(json.data ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [instanceId, hours])

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground/40">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
        <span className="text-[10px] uppercase tracking-widest animate-pulse">加载指标...</span>
      </div>
    )
  }

  // 出错
  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-xs uppercase tracking-widest text-orange-600/70">
        指标加载失败:{error}
      </div>
    )
  }

  // 空状态(表基本无数据,agent 尚未上报 metrics[])
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground/30">
        <Activity className="h-10 w-10" />
        <span className="text-xs uppercase tracking-widest">暂无历史指标(等待 Agent 上报)</span>
      </div>
    )
  }

  // 组装图表数据:x 轴用本地时间字符串,y 轴百分比 0-100
  const chartData = data.map((p) => ({
    time: new Date(p.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: p.cpu_percent ?? null,
    mem: p.mem_percent ?? null,
    disk: p.disk_percent ?? null,
  }))

  const latest = data[data.length - 1]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          指标趋势 · 近 {hours} 小时
        </span>
        <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">
          {data.length} 个采样点
        </span>
      </div>

      {/* 最新快照 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'CPU', value: latest.cpu_percent, color: 'text-cyan-600' },
          { label: '内存', value: latest.mem_percent, color: 'text-violet-600' },
          { label: '磁盘', value: latest.disk_percent, color: 'text-amber-600' },
        ].map((item) => (
          <div key={item.label} className="glass-card-premium p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black mb-1">{item.label}</div>
            <div className={`tech-mono text-2xl font-black ${item.color}`}>
              {item.value != null ? item.value.toFixed(1) : '--'}
              <span className="text-sm text-muted-foreground/50"> %</span>
            </div>
          </div>
        ))}
      </div>

      {/* 三线图 */}
      <div className="glass-card-premium p-4 rounded-2xl border border-slate-200 shadow-sm h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              unit=" %"
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
              labelStyle={{ color: '#475569', fontWeight: 'bold', textTransform: 'uppercase' }}
              formatter={(v: any, name: any) => [v != null ? `${Number(v).toFixed(1)} %` : '--', name]}
            />
            <Line type="monotone" dataKey="cpu" stroke="#0891b2" strokeWidth={2} dot={false} name="CPU" connectNulls />
            <Line type="monotone" dataKey="mem" stroke="#7c3aed" strokeWidth={2} dot={false} name="内存" connectNulls />
            <Line type="monotone" dataKey="disk" stroke="#d97706" strokeWidth={2} dot={false} name="磁盘" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-600 inline-block" />CPU</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-600 inline-block" />内存</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-600 inline-block" />磁盘</span>
      </div>
    </div>
  )
}
