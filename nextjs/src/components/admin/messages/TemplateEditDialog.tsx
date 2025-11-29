"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { updateTemplateAction } from "@/app/actions/templates"
import { toast } from "sonner"
import { Loader2, Copy } from "lucide-react"

interface TemplateEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    templateKey: string
    channel: 'email' | 'wechat'
    eventType: string
    initialContent: string
    onSuccess?: () => void
}

const AVAILABLE_VARIABLES = [
    { name: 'proxyId', description: 'Proxy ID' },
    { name: 'startsAt', description: '维护开始时间' },
    { name: 'endsAt', description: '维护结束时间' },
    { name: 'maintenanceWindowId', description: '维护窗口ID' },
    { name: 'oldStatus', description: '旧状态' },
    { name: 'status', description: '新状态' },
    { name: 'trafficInGb', description: '流量(GB)' },
    { name: 'eventType', description: '事件类型' },
    { name: 'source', description: '消息来源' },
    { name: 'receivedAt', description: '接收时间' },
    { name: 'notes', description: '备注' },
    { name: 'customContent', description: '自定义内容(备注)' }
]

export function TemplateEditDialog({
    open,
    onOpenChange,
    templateKey,
    channel,
    eventType,
    initialContent,
    onSuccess
}: TemplateEditDialogProps) {
    const [content, setContent] = useState(initialContent)
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
        try {
            setLoading(true)
            const result = await updateTemplateAction(templateKey, content)

            if (result.error) {
                toast.error('保存失败: ' + result.error)
            } else {
                toast.success('模版已保存')
                onOpenChange(false)
                onSuccess?.()
            }
        } catch (e: any) {
            toast.error('保存失败')
        } finally {
            setLoading(false)
        }
    }

    const copyVariable = (varName: string) => {
        navigator.clipboard.writeText(`{{${varName}}}`)
        toast.success(`已复制 {{${varName}}}`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>编辑模版</DialogTitle>
                    <DialogDescription>
                        <Badge variant="outline" className="mr-2">{channel === 'email' ? '邮件' : '企业微信'}</Badge>
                        {eventType}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                        <Label htmlFor="template-content">模版内容</Label>
                        <Textarea
                            id="template-content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={20}
                            className="font-mono text-sm"
                            placeholder={channel === 'email' ? 'HTML 模版内容...' : 'Markdown 模版内容...'}
                        />
                        <p className="text-xs text-muted-foreground">
                            {channel === 'email' ? '支持 HTML 标签' : '支持 Markdown 格式和企业微信特殊标签'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>可用变量</Label>
                        <div className="border rounded-md p-3 space-y-2 max-h-[500px] overflow-y-auto">
                            {AVAILABLE_VARIABLES.map(v => (
                                <div key={v.name} className="flex items-start justify-between gap-2 text-sm">
                                    <div className="flex-1 min-w-0">
                                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                            {`{{${v.name}}}`}
                                        </code>
                                        <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 flex-shrink-0"
                                        onClick={() => copyVariable(v.name)}
                                        title="复制"
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        取消
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
