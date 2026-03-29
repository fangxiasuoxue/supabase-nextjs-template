'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertSeverityBadge } from './AlertSeverityBadge'
import { ackAlertAction } from '@/app/actions/alerts'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { createSPASassClientAuthenticated } from '@/lib/supabase/client'

interface Alert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  resource_type: string
  resource_id: string
  status: string
  title: string
  content: string | null
  created_at: string
  acked_at: string | null
}

export function AlertCenterTable() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [ackingId, setAckingId] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = await createSPASassClientAuthenticated()
      const client = supabase.getSupabaseClient() as any
      let query = client
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (severity) query = query.eq('severity', severity)
      if (resourceType) query = query.eq('resource_type', resourceType)

      const { data, error } = await query
      if (error) throw error
      setAlerts(data || [])
    } catch (e: any) {
      toast.error('加载告警失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [severity, resourceType])

  useEffect(() => {
    fetch_()
    const timer = setInterval(fetch_, 60_000)
    return () => clearInterval(timer)
  }, [fetch_])

  const handleAck = async (id: string) => {
    setAckingId(id)
    try {
      const result = await ackAlertAction(id)
      if (!result.success) throw new Error(result.error)
      toast.success('告警已确认')
      fetch_()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAckingId(null)
    }
  }

  const statusStyle = (s: string) =>
    s === 'open' ? 'text-orange-400 border-orange-400/20 bg-orange-500/10'
    : s === 'acked' ? 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
    : 'text-emerald-400 border-emerald-400/20 bg-emerald-500/10'

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-40 bg-black/40 border-white/5 rounded-xl h-10 text-xs">
            <SelectValue placeholder="所有级别" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-xl">
            <SelectItem value="">所有级别</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-48 bg-black/40 border-white/5 rounded-xl h-10 text-xs">
            <SelectValue placeholder="所有资源类型" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-xl">
            <SelectItem value="">所有资源类型</SelectItem>
            <SelectItem value="vps_instance">VPS 实例</SelectItem>
            <SelectItem value="node">节点</SelectItem>
            <SelectItem value="ip_asset">IP 资产</SelectItem>
            <SelectItem value="order">订单</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" onClick={fetch_} disabled={loading} className="h-10 w-10 rounded-xl ml-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="glass-card-premium rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-white/[0.02]">
            <TableRow className="border-white/5 hover:bg-transparent h-14">
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest pl-8">级别</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">告警标题</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">资源类型</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">状态</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">触发时间</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest pr-8 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && alerts.length === 0 ? (
              <TableRow className="border-none">
                <TableCell colSpan={6} className="h-48 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/40 mx-auto" />
                </TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow className="border-none">
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                    <Bell className="h-10 w-10" />
                    <span className="text-xs font-black uppercase tracking-widest">暂无告警</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : alerts.map((alert) => (
              <TableRow key={alert.id} className="border-white/5 hover:bg-white/[0.02] h-16 group/row">
                <TableCell className="pl-8">
                  <AlertSeverityBadge severity={alert.severity} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover/row:text-primary/80 transition-colors">{alert.title}</span>
                    {alert.content && (
                      <span className="text-[9px] text-muted-foreground/50 truncate max-w-xs">{alert.content}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground/60 tech-mono">{alert.resource_type}</span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusStyle(alert.status)}`}>
                    {alert.status}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] text-muted-foreground/50">{new Date(alert.created_at).toLocaleString()}</span>
                </TableCell>
                <TableCell className="text-right pr-8">
                  {alert.status === 'open' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAck(alert.id)}
                      disabled={ackingId === alert.id}
                      className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary"
                    >
                      {ackingId === alert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '确认'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
