// @ts-nocheck
'use client'

import { useState } from 'react'
import { VPSList } from '@/components/admin/vps/VPSList'
import { VpsRegisterForm } from '@/components/admin/vps/VpsRegisterForm'
import { VpsSyncFromOpenclaw } from '@/components/admin/vps/VpsSyncFromOpenclaw'
import { useLanguage } from '@/lib/context/LanguageContext'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'

export default function AdminVPSPage() {
    const { t } = useLanguage()
    const [registerOpen, setRegisterOpen] = useState(false)
    const [syncOpen, setSyncOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('vps.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('vps.desc')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setSyncOpen(true)}
                        className="border-white/10 hover:bg-white/5 rounded-xl h-10 text-xs font-black uppercase tracking-widest"
                    >
                        <Download className="mr-2 h-3.5 w-3.5" />
                        从 OpenClaw 同步
                    </Button>
                    <Button
                        onClick={() => setRegisterOpen(true)}
                        className="rounded-xl h-10 text-xs font-black uppercase tracking-widest"
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        手动录入
                    </Button>
                </div>
            </div>

            <VPSList key={refreshKey} />

            <VpsRegisterForm
                open={registerOpen}
                onOpenChange={setRegisterOpen}
                onSuccess={() => setRefreshKey((k) => k + 1)}
            />
            <VpsSyncFromOpenclaw
                open={syncOpen}
                onOpenChange={setSyncOpen}
                onSuccess={() => setRefreshKey((k) => k + 1)}
            />
        </div>
    )
}
