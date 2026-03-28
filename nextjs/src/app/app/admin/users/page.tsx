'use client'

import { UserTable } from '@/components/admin/UserTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users } from 'lucide-react'

export default function AdminUsersPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary-400 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-primary-400/80">Admin Control / Access Management</span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">用户管理 <span className="text-primary-500">.</span></h1>
                <p className="text-muted-foreground text-sm max-w-2xl">
                    管理系统用户信息、角色映射及颗粒度权限配置。
                </p>
            </div>

            <div className="glass-card rounded-[2rem] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-xl">
                            <Users className="h-5 w-5 text-primary-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider">核心用户数据库</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">System-wide user registry and role enforcement</p>
                        </div>
                    </div>
                </div>
                <div className="p-8">
                    <UserTable />
                </div>
            </div>
        </div>
    )
}
