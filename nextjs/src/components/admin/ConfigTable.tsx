'use client'

import { useState, useEffect, useCallback } from 'react'
import { getConfigsAction, deleteConfigAction } from '@/app/actions/config'
import { SystemConfig } from '@/types/config'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfigDialog } from './ConfigDialog'
import { Loader2, Search, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useLanguage } from '@/lib/context/LanguageContext'

export function ConfigTable() {
    const [configs, setConfigs] = useState<SystemConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const { t } = useLanguage()

    const fetchConfigs = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await getConfigsAction({ search })
            if (error) {
                toast.error(t('config.error.fetch'))
            } else {
                setConfigs(data || [])
            }
        } catch {
            toast.error(t('config.error.fetch'))
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchConfigs()
        }, 500)
        return () => clearTimeout(timer)
    }, [fetchConfigs])

    const handleDelete = async (id: string) => {
        try {
            const { error } = await deleteConfigAction(id)
            if (error) {
                toast.error(t('config.error.delete'))
            } else {
                toast.success(t('config.success.deleted'))
                fetchConfigs()
            }
        } catch {
            toast.error(t('config.error.delete'))
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('config.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchConfigs} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <ConfigDialog onSuccess={fetchConfigs} />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('config.key')}</TableHead>
                            <TableHead>{t('config.value')}</TableHead>
                            <TableHead>{t('config.group')}</TableHead>
                            <TableHead>{t('config.description')}</TableHead>
                            <TableHead className="w-[100px]">{t('config.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && configs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : configs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    {t('config.empty')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            configs.map((config) => (
                                <TableRow key={config.id}>
                                    <TableCell className="font-medium">{config.key}</TableCell>
                                    <TableCell>
                                        {config.is_secret ? (
                                            <span className="text-muted-foreground italic">******</span>
                                        ) : (
                                            <span className="truncate max-w-[200px] block" title={config.value || ''}>
                                                {config.value}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{config.group}</TableCell>
                                    <TableCell className="text-muted-foreground">{config.description}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <ConfigDialog config={config} onSuccess={fetchConfigs} />
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('config.delete')}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t('config.delete.desc')}
                                                            <span className="font-mono font-bold"> {config.key}</span>.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('config.cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(config.id)} className="bg-destructive hover:bg-destructive/90">
                                                            {t('config.delete.confirm')}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
