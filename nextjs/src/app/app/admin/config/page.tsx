'use client'

import { ConfigTable } from '@/components/admin/ConfigTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/context/LanguageContext'

export default function AdminConfigPage() {
    const { t } = useLanguage()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('config.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('config.desc')}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('config.list.title')}</CardTitle>
                    <CardDescription>
                        {t('config.list.desc')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ConfigTable />
                </CardContent>
            </Card>
        </div>
    )
}
