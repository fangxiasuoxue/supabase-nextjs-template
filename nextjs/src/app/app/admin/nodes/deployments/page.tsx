'use client'

import { DeploymentStatusTracker } from '@/components/admin/nodes/DeploymentStatusTracker'
import { History } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/app/admin/nodes" className="p-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3 text-cyan-600 mb-1">
            <History className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">Deployment History</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">部署任务历史</h2>
          <p className="text-muted-foreground text-sm">实时追踪所有节点部署任务状态</p>
        </div>
      </div>
      <DeploymentStatusTracker />
    </div>
  )
}
