'use client'

import { NodeDeployForm } from '@/components/admin/nodes/NodeDeployForm'
import { Rocket } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NodeDeployPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/app/admin/nodes" className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3 text-primary mb-1">
            <Rocket className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/70">Node Deployment</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">创建部署任务</h2>
          <p className="text-muted-foreground text-sm">选择目标 VPS 与协议模板，发起节点部署</p>
        </div>
      </div>
      <NodeDeployForm />
    </div>
  )
}
