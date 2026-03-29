'use client'

import { DeploymentStatusTracker } from '@/components/admin/nodes/DeploymentStatusTracker'
import { History } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/app/admin/nodes" className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3 text-primary mb-1">
            <History className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/70">Deployment History</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">部署任务历史</h2>
          <p className="text-muted-foreground text-sm">实时追踪所有节点部署任务状态</p>
        </div>
      </div>
      <DeploymentStatusTracker />
    </div>
  )
}
