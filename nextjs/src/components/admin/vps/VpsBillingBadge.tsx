'use client'

interface BillingData {
  credit_remaining: number | null
  cost_30d: number | null
  upload_bytes: number | null
  download_bytes: number | null
  billing_updated_at: string | null
}

export function VpsBillingBadge({ billing }: { billing: BillingData | null }) {
  if (!billing) {
    return (
      <div className="flex flex-col items-end">
        <span className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">来自账单系统</span>
        <span className="tech-mono text-xs text-muted-foreground/30">--</span>
      </div>
    )
  }

  const balance = billing.credit_remaining
  const balanceColor =
    balance === null ? 'text-muted-foreground/40'
    : balance < 0 ? 'text-red-400'
    : balance < 5 ? 'text-orange-400'
    : 'text-emerald-400'

  const formatBytes = (b: number | null) => {
    if (!b) return '--'
    if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`
    return `${(b / 1e9).toFixed(2)} GB`
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">来自账单系统</span>
      <span className={`tech-mono text-sm font-black tracking-tighter ${balanceColor}`}>
        ${balance?.toFixed(2) ?? '--'}
      </span>
      {billing.cost_30d !== null && (
        <span className="text-[9px] text-muted-foreground/50 font-bold uppercase">
          30d: ${billing.cost_30d.toFixed(2)}
        </span>
      )}
      {(billing.upload_bytes || billing.download_bytes) && (
        <span className="text-[8px] text-muted-foreground/40 font-bold tech-mono">
          ↑{formatBytes(billing.upload_bytes)} ↓{formatBytes(billing.download_bytes)}
        </span>
      )}
    </div>
  )
}
