'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface BillingData {
  credit_remaining: number | null
  cost_30d: number | null
  upload_bytes: number | null
  download_bytes: number | null
  billing_updated_at: string | null
}

interface Props {
  billing: BillingData | null
}

export function VpsTrafficSparkline({ billing }: Props) {
  if (!billing) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground/30 text-xs uppercase tracking-widest">
        暂无账单数据
      </div>
    )
  }

  // 当前只有最新一条快照，用单点展示；待 traffic_snapshots 多条时可扩展
  const uploadGB = billing.upload_bytes ? (billing.upload_bytes / 1e9).toFixed(2) : '0'
  const downloadGB = billing.download_bytes ? (billing.download_bytes / 1e9).toFixed(2) : '0'

  const mockData = [
    { day: '7天前', upload: 0, download: 0 },
    { day: '最新', upload: parseFloat(uploadGB), download: parseFloat(downloadGB) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">流量趋势</span>
        <span className="text-[8px] text-orange-600 font-bold uppercase tracking-widest">
          ⚠ 数据来自账单系统（约1天延迟）
          {billing.billing_updated_at && ` · 更新于 ${new Date(billing.billing_updated_at).toLocaleDateString()}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card-premium p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black mb-1">上行流量 ↑</div>
          <div className="tech-mono text-2xl font-black text-primary/80">{uploadGB} <span className="text-sm text-muted-foreground/50">GB</span></div>
        </div>
        <div className="glass-card-premium p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black mb-1">下行流量 ↓</div>
          <div className="tech-mono text-2xl font-black text-green-600">{downloadGB} <span className="text-sm text-muted-foreground/50">GB</span></div>
        </div>
      </div>

      <div className="glass-card-premium p-4 rounded-2xl border border-slate-200 shadow-sm h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockData}>
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} unit=" GB" />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
              labelStyle={{ color: '#475569', fontWeight: 'bold', textTransform: 'uppercase' }}
            />
            <Line type="monotone" dataKey="upload" stroke="#0891b2" strokeWidth={2} dot={false} name="上行 GB" />
            <Line type="monotone" dataKey="download" stroke="#10b981" strokeWidth={2} dot={false} name="下行 GB" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-600 inline-block" />上行</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block" />下行</span>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground/50 font-bold uppercase tracking-wider">账户余额</span>
          <span className={`tech-mono font-black ${(billing.credit_remaining ?? 0) < 5 ? 'text-orange-600' : 'text-green-600'}`}>
            ${billing.credit_remaining?.toFixed(2) ?? '--'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground/50 font-bold uppercase tracking-wider">近30天费用</span>
          <span className="tech-mono font-black text-muted-foreground/80">
            ${billing.cost_30d?.toFixed(2) ?? '--'}
          </span>
        </div>
      </div>
    </div>
  )
}
