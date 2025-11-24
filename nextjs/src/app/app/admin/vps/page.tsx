'use client'

import { VPSList } from '@/components/admin/vps/VPSList'
import { useLanguage } from '@/lib/context/LanguageContext'

export default function AdminVPSPage() {
    const { t } = useLanguage()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('vps.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('vps.desc')}
                    </p>
                </div>
            </div>
            <VPSList />
        </div>
    )
}
