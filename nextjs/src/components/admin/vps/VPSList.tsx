'use client'

import { useState, useEffect, useCallback } from 'react'
import { getVPSInstancesAction, syncAllVPSAction, syncAccountVPSAction } from '@/app/actions/vps'
import { VPSData, VPSInstance } from '@/types/vps'
import { useLanguage } from '@/lib/context/LanguageContext'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Server, Activity, CreditCard, AlertCircle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function VPSList() {
    const [data, setData] = useState<VPSData | null>(null)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [syncingAccount, setSyncingAccount] = useState<string | null>(null)
    const { t } = useLanguage()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: vpsData, error } = await getVPSInstancesAction()
            if (error) {
                toast.error(t('vps.error.fetch'))
                console.error(error)
            } else {
                setData(vpsData)
            }
        } catch (err) {
            toast.error(t('vps.error.fetch'))
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSyncAll = async () => {
        setSyncing(true)
        try {
            toast.info('Starting global sync...')
            const { results } = await syncAllVPSAction()
            const errors = results.filter(r => !r.success)
            if (errors.length > 0) {
                toast.error(`Sync completed with ${errors.length} errors`)
                console.error('Sync errors:', errors)
            } else {
                toast.success('Global sync completed successfully')
            }
            fetchData() // Refresh data from DB
        } catch (err) {
            toast.error('Global sync failed')
            console.error(err)
        } finally {
            setSyncing(false)
        }
    }

    const handleSyncAccount = async (account: string) => {
        setSyncingAccount(account)
        try {
            toast.info(`Syncing account ${account}...`)
            const { success, error } = await syncAccountVPSAction(account)
            if (!success) {
                toast.error(`Sync failed for ${account}: ${error}`)
            } else {
                toast.success(`Sync completed for ${account}`)
                fetchData() // Refresh data from DB
            }
        } catch (err) {
            toast.error(`Sync failed for ${account}`)
            console.error(err)
        } finally {
            setSyncingAccount(null)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'RUNNING':
                return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
            case 'TERMINATED':
                return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            case 'STOPPING':
            case 'SUSPENDED':
                return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
            default:
                return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
        }
    }

    const formatTraffic = (gb: number) => {
        return gb.toFixed(2) + ' GB'
    }

    // Group instances by account to show unique accounts in summary or for sync buttons?
    // Actually, user wants "sync traffic" button on the right of each row, 
    // but "if one account has multiple vps, show same".
    // So the button is per row, but triggers account sync.

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {data?.lastUpdated && (
                        <span>
                            {t('vps.lastUpdated')}: {new Date(data.lastUpdated).toLocaleString()}
                        </span>
                    )}
                </div>
                <Button onClick={handleSyncAll} disabled={syncing} variant="default" size="sm">
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {t('vps.sync')}
                </Button>
            </div>

            {data?.errors && data.errors.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sync Errors</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-4">
                            {data.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('vps.table.instance')}
                        </CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.instances.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('vps.table.traffic')}
                        </CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data ? formatTraffic(data.instances.reduce((acc, curr) => acc + (curr.trafficReceived + curr.trafficSent), 0)) : '0.00 GB'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('vps.traffic.total')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('vps.billing.title')}
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {/* Calculate total remaining across unique accounts */}
                        <div className="text-2xl font-bold">
                            {data ?
                                '$' + Array.from(new Set(data.instances.map(i => i.account)))
                                    .map(acc => data.instances.find(i => i.account === acc)?.billingRemaining || 0)
                                    .reduce((a, b) => a + b, 0).toFixed(2)
                                : '$0.00'
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('vps.billing.remaining')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Instances Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('vps.table.account')}</TableHead>
                            <TableHead>{t('vps.table.instance')}</TableHead>
                            <TableHead>{t('vps.table.zone')}</TableHead>
                            <TableHead>{t('vps.table.machineType')}</TableHead>
                            <TableHead>{t('vps.table.ip')}</TableHead>
                            <TableHead>{t('vps.table.status')}</TableHead>
                            <TableHead className="text-right">{t('vps.table.traffic')}</TableHead>
                            <TableHead className="text-right">{t('vps.billing.title')}</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && !data ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : !data?.instances.length ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                    {t('vps.empty')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.instances.map((instance) => {
                                const totalTraffic = instance.trafficReceived + instance.trafficSent
                                return (
                                    <TableRow key={instance.id}>
                                        <TableCell className="font-medium">{instance.account}</TableCell>
                                        <TableCell>{instance.name}</TableCell>
                                        <TableCell>{instance.zone}</TableCell>
                                        <TableCell>{instance.machineType}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col space-y-1 text-xs">
                                                {instance.externalIp && (
                                                    <span className="font-mono">{instance.externalIp}</span>
                                                )}
                                                {instance.internalIp && (
                                                    <span className="font-mono text-muted-foreground">{instance.internalIp}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={getStatusColor(instance.status)}>
                                                {instance.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col space-y-1 text-xs">
                                                <span className="font-bold">{formatTraffic(totalTraffic)}</span>
                                                <span className="text-muted-foreground">
                                                    ↓{formatTraffic(instance.trafficReceived)} ↑{formatTraffic(instance.trafficSent)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col space-y-1 text-xs">
                                                <span className={instance.billingRemaining < 0 ? 'text-red-500 font-bold' : 'text-green-500'}>
                                                    ${instance.billingRemaining.toFixed(2)}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    Used: ${instance.billingUsed.toFixed(2)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleSyncAccount(instance.account)}
                                                disabled={syncingAccount === instance.account}
                                                title={`Sync ${instance.account}`}
                                            >
                                                <RefreshCw className={`h-4 w-4 ${syncingAccount === instance.account ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
