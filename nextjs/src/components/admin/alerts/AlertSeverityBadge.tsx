// @ts-nocheck
interface Props {
  severity: 'info' | 'warning' | 'critical'
}

const styles = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-400/20',
  warning: 'text-orange-400 bg-orange-500/10 border-orange-400/20',
  critical: 'text-red-400 bg-red-500/10 border-red-400/20',
}

export function AlertSeverityBadge({ severity }: Props) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${styles[severity] ?? styles.info}`}>
      {severity}
    </span>
  )
}
