"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getTemplatesAction, resetTemplateAction, TemplateItem } from "@/app/actions/templates"
import { TemplateEditDialog } from "./TemplateEditDialog"
import { toast } from "sonner"
import { Loader2, Edit, RotateCcw, Settings } from "lucide-react"

export function TemplateManagementDialog() {
    const [open, setOpen] = useState(false)
    const [templates, setTemplates] = useState<TemplateItem[]>([])
    const [loading, setLoading] = useState(false)
    const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'wechat'>('all')

    const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const loadTemplates = async () => {
        setLoading(true)
        try {
            const result = await getTemplatesAction()
            if (result.error) {
                toast.error('加载失败: ' + result.error)
            } else {
                setTemplates(result.data)
            }
        } catch (e: any) {
            toast.error('加载失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            loadTemplates()
        }
    }, [open])

    const handleEdit = (template: TemplateItem) => {
        setEditingTemplate(template)
        setEditDialogOpen(true)
    }

    const handleReset = async (template: TemplateItem) => {
        if (!confirm(`确定要将此模版重置为默认吗?\n\n${template.eventType}`)) {
            return
        }

        try {
            const result = await resetTemplateAction(template.key)
            if (result.error) {
                toast.error('重置失败: ' + result.error)
            } else {
                toast.success('已重置为默认模版')
                loadTemplates()
            }
        } catch (e: any) {
            toast.error('重置失败')
        }
    }

    const filteredTemplates = templates.filter(t =>
        channelFilter === 'all' || t.channel === channelFilter
    )

    const getEventTypeLabel = (eventType: string) => {
        const labels: Record<string, string> = {
            'proxy.maintenance_window.created': '维护窗口创建',
            'proxy.maintenance_window.cancelled': '维护窗口取消',
            'proxy.status.changed': '状态变更',
            'proxy.bandwidth.added': '流量增加'
        }
        return labels[eventType] || eventType
    }

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        模版管理
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>消息模版管理</DialogTitle>
                        <DialogDescription>
                            管理邮件和企业微信的消息模版,支持自定义变量替换
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">渠道筛选:</label>
                                <Select value={channelFilter} onValueChange={(v: any) => setChannelFilter(v)}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="email">邮件</SelectItem>
                                        <SelectItem value="wechat">企业微信</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '刷新'}
                            </Button>
                        </div>

                        {loading && templates.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>渠道</TableHead>
                                            <TableHead>事件类型</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>内容预览</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTemplates.map((template) => (
                                            <TableRow key={template.key}>
                                                <TableCell>
                                                    <Badge variant={template.channel === 'email' ? 'default' : 'secondary'}>
                                                        {template.channel === 'email' ? '邮件' : '企业微信'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {getEventTypeLabel(template.eventType)}
                                                </TableCell>
                                                <TableCell>
                                                    {template.isDefault ? (
                                                        <Badge variant="outline">默认</Badge>
                                                    ) : (
                                                        <Badge variant="default">自定义</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <div className="text-sm text-muted-foreground truncate">
                                                        {template.content.substring(0, 100)}...
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(template)}
                                                            title="编辑"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        {!template.isDefault && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleReset(template)}
                                                                title="重置为默认"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        )}
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

            {editingTemplate && (
                <TemplateEditDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    templateKey={editingTemplate.key}
                    channel={editingTemplate.channel}
                    eventType={editingTemplate.eventType}
                    initialContent={editingTemplate.content}
                    onSuccess={() => {
                        loadTemplates()
                        setEditingTemplate(null)
                    }}
                />
            )}
        </>
    )
}
