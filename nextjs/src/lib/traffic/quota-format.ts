// P2e · 配额/流量展示纯函数 —— 供后台配额进度条、流量榜与告警口径复用。
// 设计依据:docs/current/51 §12.5/§12.6。字节口径统一 1024 进制(与 xray/系统一致)。

export type QuotaLevel = 'none' | 'ok' | 'warn' | 'over'

/** 人类可读字节(1024 进制,保留 1~2 位)。负数/非数 → '0 B'。 */
export function formatBytes(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (v < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let x = v
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  const digits = i === 0 ? 0 : x < 10 ? 2 : 1
  return `${x.toFixed(digits)} ${units[i]}`
}

/**
 * 配额用量百分比(0~，可 >100)。quota 无(null/<=0)→ null(不限,不适用百分比)。
 * used 为负/非数按 0。
 */
export function quotaPercent(used: number | null | undefined, quota: number | null | undefined): number | null {
  if (typeof quota !== 'number' || !Number.isFinite(quota) || quota <= 0) return null
  const u = typeof used === 'number' && Number.isFinite(used) && used > 0 ? used : 0
  return (u / quota) * 100
}

/**
 * 配额档位:none(不限)/ok(<80%)/warn(80~100%)/over(>=100%)。
 * 阈值与巡检告警口径一致(§12.6:80% WARN / 100% CRIT)。
 */
export function quotaLevel(used: number | null | undefined, quota: number | null | undefined): QuotaLevel {
  const pct = quotaPercent(used, quota)
  if (pct === null) return 'none'
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}
