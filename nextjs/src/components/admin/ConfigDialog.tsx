'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { upsertConfigAction } from '@/app/actions/config'
import { SystemConfig } from '@/types/config'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil } from 'lucide-react'
import { useLanguage } from '@/lib/context/LanguageContext'

interface ConfigDialogProps {
    config?: SystemConfig
    onSuccess: () => void
}

export function ConfigDialog({ config, onSuccess }: ConfigDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { t } = useLanguage()
    const [formData, setFormData] = useState({
        key: '',
        value: '',
        description: '',
        group: '',
        is_secret: false,
    })

    useEffect(() => {
        if (open) {
            if (config) {
                setFormData({
                    key: config.key,
                    value: config.value || '',
                    description: config.description || '',
                    group: config.group || '',
                    is_secret: config.is_secret,
                })
            } else {
                setFormData({
                    key: '',
                    value: '',
                    description: '',
                    group: '',
                    is_secret: false,
                })
            }
        }
    }, [open, config])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await upsertConfigAction({
                id: config?.id,
                ...formData,
            })

            if (error) {
                toast.error(error)
            } else {
                toast.success(config ? t('config.success.updated') : t('config.success.created'))
                setOpen(false)
                onSuccess()
            }
        } catch {
            toast.error(t('config.error.generic'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {config ? (
                    <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('config.add')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{config ? t('config.edit') : t('config.add')}</DialogTitle>
                    <DialogDescription>
                        {config ? t('config.desc') : t('config.desc')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="key">{t('config.key')}</Label>
                        <Input
                            id="key"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            placeholder="e.g., vps.gcp.api_key"
                            disabled={!!config} // Disable key editing for now to avoid complexity
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="value">{t('config.value')}</Label>
                        <Input
                            id="value"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            placeholder={t('config.value')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group">{t('config.group')}</Label>
                        <Input
                            id="group"
                            value={formData.group}
                            onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                            placeholder="e.g., vps, payment"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">{t('config.description')}</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder={t('config.description')}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="is_secret"
                            checked={formData.is_secret}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_secret: checked })}
                        />
                        <Label htmlFor="is_secret">{t('config.secret')}</Label>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('config.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
