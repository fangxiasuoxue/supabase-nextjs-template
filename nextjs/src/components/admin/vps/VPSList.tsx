'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getVPSInstancesAction, syncAllVPSAction, syncAccountVPSAction } from '@/app/actions/vps'
import { checkIsAdmin, getUserPermissionsAction } from '@/app/actions/auth'
import { VPSData, VPSInstance } from '@/types/vps'
import { useLanguage } from '@/lib/context/LanguageContext'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Server, Activity, CreditCard, AlertCircle, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { VPSAuthDialog } from './VPSAuthDialog'

export function VPSList() {
    const [data, setData] = useState<VPSData | null>(null)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [syncingAccount, setSyncingAccount] = useState<string | null>(null)
    const [canManage, setCanManage] = useState(false)
    const { t } = useLanguage()

    // Filters
    const [filterIp, setFilterIp] = useState('')
    const [filterName, setFilterName] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterAccount, setFilterAccount] = useState('')
    const [authDialogOpen, setAuthDialogOpen] = useState(false)
    const [selectedVpsId, setSelectedVpsId] = useState('')
    const [selectedVpsName, setSelectedVpsName] = useState('')

    const checkPermissions = useCallback(async () => {
        try {
            const isAdmin = await checkIsAdmin()
            if (isAdmin) {
                setCanManage(true)
                return
            }
            const permissions: any = await getUserPermissionsAction()
            const vpsPerm = permissions.find((p: any) => p.module === 'vps')
            if (vpsPerm?.can_manage) {
                setCanManage(true)
            }
        } catch (error) {
            console.error('Error checking permissions:', error)
        }
    }, [])

    const fetchData = useCallback(async () => {
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
        }
    }, [t])

    useEffect(() => {
        // 并行执行权限检查和数据获取以提高性能
        const loadData = async () => {
            setLoading(true)
            try {
                await Promise.all([checkPermissions(), fetchData()])
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [checkPermissions, fetchData])

    const handleSyncAll = async () => {
        if (!canManage) return
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
        if (!canManage) return
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

    const getStatusStyles = (status: string) => {
        switch (status.toUpperCase()) {
            case 'RUNNING':
                return 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20 status-glow-success'
            case 'TERMINATED':
                return 'text-rose-400 bg-rose-500/10 border-rose-400/20'
            case 'STOPPING':
            case 'SUSPENDED':
                return 'text-amber-400 bg-amber-500/10 border-amber-400/20'
            default:
                return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
        }
    }

    const formatTraffic = (gb: number) => {
        return gb.toFixed(2) + ' GB'
    }

    const filteredInstances = useMemo(() => {
        if (!data?.instances) return []
        return data.instances.filter(inst => {
            const matchIp = (inst.internalIp?.includes(filterIp) || inst.externalIp?.includes(filterIp)) || !filterIp
            const matchName = inst.name.toLowerCase().includes(filterName.toLowerCase()) || !filterName
            const matchStatus = inst.status.toLowerCase().includes(filterStatus.toLowerCase()) || !filterStatus
            const matchAccount = inst.account.toLowerCase().includes(filterAccount.toLowerCase()) || !filterAccount
            return matchIp && matchName && matchStatus && matchAccount
        })
    }, [data, filterIp, filterName, filterStatus, filterAccount])

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Filtering Engine */}
            <div className="glass-card-premium p-6 rounded-[2rem] border border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">IP 寻址 / ADDRESS</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/40" />
                            <Input
                                placeholder="0.0.0.0"
                                value={filterIp}
                                onChange={(e) => setFilterIp(e.target.value)}
                                className="pl-9 bg-black/40 border-white/5 rounded-xl h-11 tech-mono font-bold focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">识别标识 / IDENTIFIER</label>
                        <Input
                            placeholder="INSTANCE NAME"
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            className="bg-black/40 border-white/5 rounded-xl h-11 uppercase font-black text-[11px] tracking-tight focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">生存状态 / STATUS</label>
                        <Input
                            placeholder="ANY_STATE"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-black/40 border-white/5 rounded-xl h-11 uppercase font-black text-[11px] tracking-tight focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">权属账号 / ACCOUNT</label>
                        <Input
                            placeholder="CORE_IDENTITY"
                            value={filterAccount}
                            onChange={(e) => setFilterAccount(e.target.value)}
                            className="bg-black/40 border-white/5 rounded-xl h-11 uppercase font-black text-[11px] tracking-tight focus:ring-primary/20"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
                        <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">实时指标控制台</span>
                        {data?.lastUpdated && (
                            <span className="text-[8px] text-muted-foreground uppercase font-bold tech-mono">
                                Last Sync: {new Date(data.lastUpdated).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
                {canManage && (
                    <Button 
                        onClick={handleSyncAll} 
                        disabled={syncing} 
                        className="bg-white/5 hover:bg-white/10 text-foreground border border-white/5 rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-primary/30"
                    >
                        <RefreshCw className={`mr-3 h-3.5 w-3.5 text-primary ${syncing ? 'animate-spin' : ''}`} />
                        {t('vps.sync')}
                    </Button>
                )}
            </div>

            {data?.errors && data.errors.length > 0 && (
                <Alert className="bg-rose-500/10 border-rose-500/20 rounded-[1.5rem] p-6">
                    <AlertCircle className="h-5 w-5 text-rose-400" />
                    <AlertTitle className="text-sm font-black uppercase tracking-widest text-rose-400 ml-2">同步异常检测 / CRITICAL</AlertTitle>
                    <AlertDescription className="mt-2 text-[11px] font-bold text-rose-400/80 uppercase tracking-wider ml-2">
                        <ul className="list-disc pl-4 space-y-1">
                            {data.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Metrics Dashboard */}
            <div className="grid gap-6 md:grid-cols-3">
                {[
                    { title: t('vps.table.instance'), value: `${filteredInstances.length} / ${data?.instances.length || 0}`, icon: Server, sub: "Instances Online", color: "text-primary-400" },
                    { title: t('vps.table.traffic'), value: formatTraffic(filteredInstances.reduce((acc, curr) => acc + (curr.trafficReceived + curr.trafficSent), 0)), icon: Activity, sub: "Traffic Processed", color: "text-emerald-400" },
                    { title: t('vps.billing.title'), value: '$' + Array.from(new Set(filteredInstances.map(i => i.account))).map(acc => filteredInstances.find(i => i.account === acc)?.billingRemaining || 0).reduce((a, b) => a + b, 0).toFixed(2), icon: CreditCard, sub: "Remaining Balance", color: "text-amber-400" }
                ].map((stat, i) => (
                    <div key={i} className="glass-card-premium p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group/card shadow-lg">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover/card:border-white/10 transition-colors ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{stat.title}</span>
                                <span className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-tighter">{stat.sub}</span>
                            </div>
                        </div>
                        <div className="text-3xl font-black tech-mono uppercase tracking-tighter group-hover:text-primary transition-colors relative z-10">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Main Infrastructure Table */}
            <div className="glass-card-premium rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl bg-white/[0.01]">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-white/[0.02]">
                            <TableRow className="border-white/5 hover:bg-transparent h-16">
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] pl-10">权属 / ACCOUNT</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">标识 / IDENTIFIER</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">区域配置 / ENV</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">中枢寻址 / NETWORK</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">运行状态 / STATUS</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] text-right">流量负荷 / LOAD</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] text-right">结算 / BILLING</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.15em] text-right pr-10">操作 / CTRL</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && !data ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={8} className="h-96 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">建立核心数据同步链路...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredInstances.length === 0 ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={8} className="h-96 text-center">
                                        <div className="flex flex-col items-center justify-center gap-6 opacity-30">
                                            <Server className="h-16 w-16" />
                                            <span className="text-xs font-black uppercase tracking-[0.3em]">{t('vps.empty')}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInstances.map((instance) => {
                                    const totalTraffic = instance.trafficReceived + instance.trafficSent
                                    return (
                                        <TableRow key={instance.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group/row h-24">
                                            <TableCell className="pl-10">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight group-hover/row:text-primary/80 transition-colors">{instance.account}</span>
                                                    <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">Main Node Account</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-foreground uppercase tracking-tighter">{instance.name}</span>
                                                    <span className="text-[9px] text-muted-foreground/60 font-medium lowercase tracking-tighter">{instance.machineType}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{instance.zone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col space-y-1">
                                                    {instance.externalIp && (
                                                        <span className="tech-mono text-[11px] font-black text-primary/80 tracking-tight">{instance.externalIp}</span>
                                                    )}
                                                    {instance.internalIp && (
                                                        <span className="tech-mono text-[9px] text-muted-foreground/40 font-bold tracking-tighter lowercase">{instance.internalIp}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`inline-flex px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${getStatusStyles(instance.status)}`}>
                                                    {instance.status}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="tech-mono text-sm font-black text-foreground tracking-tighter">{formatTraffic(totalTraffic)}</span>
                                                    <div className="flex gap-2 text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                                                        <span>IN: {formatTraffic(instance.trafficReceived)}</span>
                                                        <span>OUT: {formatTraffic(instance.trafficSent)}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`tech-mono text-sm font-black tracking-tighter ${instance.billingRemaining < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                                                        ${instance.billingRemaining.toFixed(2)}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">Remaining Credit</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-10">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canManage && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setSelectedVpsId(instance.id)
                                                                    setSelectedVpsName(instance.name)
                                                                    setAuthDialogOpen(true)
                                                                }}
                                                                className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all"
                                                            >
                                                                <UserPlus className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSyncAccount(instance.account)}
                                                                disabled={syncingAccount === instance.account}
                                                                className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all"
                                                            >
                                                                <RefreshCw className={`h-4 w-4 ${syncingAccount === instance.account ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <VPSAuthDialog
                open={authDialogOpen}
                onOpenChange={setAuthDialogOpen}
                vpsId={selectedVpsId}
                vpsName={selectedVpsName}
            />
        </div>
    )
}
