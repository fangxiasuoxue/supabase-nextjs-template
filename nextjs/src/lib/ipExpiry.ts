// IP 到期状态(纯函数,便于单元测试)。规则(来自需求):
//  - 到期日在 3 天内(未来)      → yellow(快到期)
//  - 已过期(过去 0–30 天)       → red(其中"7天内"是子集)
//  - 已过期超过 30 天            → hidden(不显示)
//  - 其它(>3 天后到期 / 无到期日)→ green(正常/长期)
// 排序:按 expires_at 升序(最紧急/最早到期在前),无到期日排最后。

export type ExpiryTone = 'green' | 'yellow' | 'red'

export interface ExpiryStatus {
  hidden: boolean
  tone: ExpiryTone
  daysToExpiry: number | null // >0 未来剩余天;<0 已过期天数;null 无到期日
  label: string
}

const DAY = 86400000

export function ipExpiryStatus(expiresAt: string | null | undefined, nowMs: number = Date.now()): ExpiryStatus {
  if (!expiresAt) return { hidden: false, tone: 'green', daysToExpiry: null, label: '长期' }
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return { hidden: false, tone: 'green', daysToExpiry: null, label: '长期' }
  const days = Math.floor((t - nowMs) / DAY)
  if (days < -30) return { hidden: true, tone: 'red', daysToExpiry: days, label: '已过期' }
  if (days < 0) return { hidden: false, tone: 'red', daysToExpiry: days, label: `已过期${-days}天` }
  if (days <= 3) return { hidden: false, tone: 'yellow', daysToExpiry: days, label: days === 0 ? '今天到期' : `${days}天后到期` }
  return { hidden: false, tone: 'green', daysToExpiry: days, label: `${days}天后到期` }
}

// 到期升序比较器;无到期日(null)排最后
export function compareByExpiry(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? new Date(a).getTime() : Infinity
  const tb = b ? new Date(b).getTime() : Infinity
  const va = Number.isNaN(ta) ? Infinity : ta
  const vb = Number.isNaN(tb) ? Infinity : tb
  return va - vb
}

// tone → tailwind 文本/边框/背景(亮色)
export const EXPIRY_TONE_CLASS: Record<ExpiryTone, string> = {
  green: 'text-green-700 border-green-200 bg-green-50',
  yellow: 'text-amber-700 border-amber-200 bg-amber-50',
  red: 'text-red-700 border-red-200 bg-red-50',
}
