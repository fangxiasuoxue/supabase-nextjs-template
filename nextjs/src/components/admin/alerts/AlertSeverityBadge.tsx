interface Props {
  severity: 'info' | 'warning' | 'critical'
}

const styles = {
  info: 'text-blue-700 bg-blue-50 border-blue-200',
  warning: 'text-orange-700 bg-orange-50 border-orange-200',
  critical: 'text-red-700 bg-red-50 border-red-200',
}

export function AlertSeverityBadge({ severity }: Props) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${styles[severity] ?? styles.info}`}>
      {severity}
    </span>
  )
}
