"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getPushConfigsAction, updatePushConfigAction, deletePushConfigAction, PushConfig } from "@/app/actions/pushConfigs"
import { toast } from "sonner"
import { Loader2, Plus, Edit, Trash2, Send } from "lucide-react"

export function PushConfigManagementDialog() {
    const [open, setOpen] = useState(false)
    const [configs, setConfigs] = useState<PushConfig[]>([])
    const [loading, setLoading] = useState(false)

    const [editingConfig, setEditingConfig] = useState<PushConfig | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const loadConfigs = async () => {
        setLoading(true)
        try {
            const result = await getPushConfigsAction()
            if (result.error) {
                toast.error('加载失败: ' + result.error)
            } else {
                setConfigs(result.data)
            }
        } catch (e: any) {
            toast.error('加载失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            loadConfigs()
        }
    }, [open])

    const handleAdd = () => {
        setEditingConfig({ userId: '', botUrl: '', autoEnabled: false })
        setEditDialogOpen(true)
    }

    const handleEdit = (config: PushConfig) => {
        setEditingConfig(config)
        setEditDialogOpen(true)
    }

    const handleDelete = async (userId: string) => {
        if (!confirm(`确定要删除用户 ${userId} 的推送配置吗?`)) {
            return
        }

        try {
            const result = await deletePushConfigAction(userId)
            if (result.error) {
                toast.error('删除失败: ' + result.error)
            } else {
                toast.success('删除成功')
                loadConfigs()
            }
        } catch (e: any) {
            toast.error('删除失败')
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Send className="h-4 w-4 mr-2" />
                        推送管理
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>企业微信推送配置</DialogTitle>
                        <DialogDescription>
                            管理多个企业微信机器人和自动推送设置
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                配置多个企业微信机器人,支持手动推送和自动推送
                            </p>
                            <Button onClick={handleAdd} size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                添加配置
                            </Button>
                        </div>

                        {loading && configs.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                            </div>
                        ) : configs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                暂无配置,点击"添加配置"开始
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>用户ID</TableHead>
                                            <TableHead>机器人URL</TableHead>
                                            <TableHead>自动推送</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {configs.map((config) => (
                                            <TableRow key={config.userId}>
                                                <TableCell className="font-medium">
                                                    {config.userId}
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <div className="text-sm text-muted-foreground truncate">
                                                        {config.botUrl || <span className="text-destructive">未配置</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {config.autoEnabled ? (
                                                        <Badge variant="default">已启用</Badge>
                                                    ) : (
                                                        <Badge variant="outline">已禁用</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(config)}
                                                            title="编辑"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(config.userId)}
                                                            title="删除"
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {editingConfig && (
                <PushConfigEditDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    config={editingConfig}
                    onSuccess={() => {
                        loadConfigs()
                        setEditingConfig(null)
                    }}
                />
            )}
        </>
    )
}

function PushConfigEditDialog({
    open,
    onOpenChange,
    config,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    config: PushConfig
    onSuccess?: () => void
}) {
    const [userId, setUserId] = useState(config.userId)
    const [botUrl, setBotUrl] = useState(config.botUrl)
    const [autoEnabled, setAutoEnabled] = useState(config.autoEnabled)
    const [loading, setLoading] = useState(false)

    const isNew = !config.userId

    const handleSave = async () => {
        if (!userId.trim()) {
            toast.error('请输入用户ID')
            return
        }
        if (!botUrl.trim()) {
            toast.error('请输入机器人URL')
            return
        }

        try {
            setLoading(true)
            const result = await updatePushConfigAction(userId.trim(), botUrl.trim(), autoEnabled)

            if (result.error) {
                toast.error('保存失败: ' + result.error)
            } else {
                toast.success('保存成功')
                onOpenChange(false)
                onSuccess?.()
            }
        } catch (e: any) {
            toast.error('保存失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isNew ? '添加推送配置' : '编辑推送配置'}</DialogTitle>
                    <DialogDescription>
                        配置企业微信机器人URL和自动推送设置
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="userId">用户ID *</Label>
                        <Input
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="例如: user1, user2"
                            disabled={!isNew}
                        />
                        <p className="text-xs text-muted-foreground">
                            用于区分不同的推送目标,创建后不可修改
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="botUrl">机器人 Webhook URL *</Label>
                        <Input
                            id="botUrl"
                            value={botUrl}
                            onChange={(e) => setBotUrl(e.target.value)}
                            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                        />
                        <p className="text-xs text-muted-foreground">
                            企业微信机器人的完整 Webhook URL
                        </p>
                    </div>

                    <div className="flex items-center justify-between space-x-2 border rounded-lg p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="autoEnabled">自动推送</Label>
                            <p className="text-xs text-muted-foreground">
                                收到新消息时自动推送到此机器人
                            </p>
                        </div>
                        <Switch
                            id="autoEnabled"
                            checked={autoEnabled}
                            onCheckedChange={setAutoEnabled}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        取消
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
