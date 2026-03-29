'use client'

import { AlertCenterTable } from '@/components/admin/alerts/AlertCenterTable'
import { Bell } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-3 text-primary mb-1">
          <Bell className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/70">Alert Center</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight">告警中心</h2>
        <p className="text-muted-foreground text-sm">统一管理心跳/流量/IP/账单告警，每60秒自动刷新</p>
      </div>
      <AlertCenterTable />
    </div>
  )
}
