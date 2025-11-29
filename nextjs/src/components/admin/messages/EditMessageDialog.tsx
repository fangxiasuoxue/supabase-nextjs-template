'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ExternalMessage } from '@/types/message'
import { Edit, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EditMessageDialogProps {
    message: ExternalMessage
    open: boolean
    onClose: () => void
    onSave: (data: { notes: string }) => Promise<boolean>
}

export function EditMessageDialog({ message, open, onClose, onSave }: EditMessageDialogProps) {
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) {
            setNotes(message.notes || '')
        }
    }, [open, message.notes])

    const handleSave = async () => {
        setSaving(true)
        try {
            const success = await onSave({ notes })
            if (!success) {
                // Error is already handled in parent component
            }
        } finally {
            setSaving(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSave()
        }
        if (e.key === 'Escape') {
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl" onKeyDown={handleKeyDown}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="h-5 w-5" />
                        编辑消息
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 消息详情 */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">消息ID:</span>
                                <span className="ml-2 font-mono">#{message.id}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">来源:</span>
                                <span className="ml-2">{message.source}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">事件类型:</span>
                                <span className="ml-2 font-mono">{message.event_type}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">状态:</span>
                                <span className="ml-2">{message.is_read ? '已读' : '未读'}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-600 dark:text-gray-400">接收时间:</span>
                                <span className="ml-2">{new Date(message.received_at).toLocaleString('zh-CN')}</span>
                            </div>
                        </div>
                    </div>

                    {/* 编辑备注 */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">备注编辑</Label>
                        <Textarea
                            id="notes"
                            placeholder="在这里添加或修改消息备注..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={8}
                            className="resize-none"
                        />
                        <p className="text-xs text-gray-500">
                            快捷键: Ctrl+S 保存, Esc 取消
                        </p>
                    </div>

                    {/* 自定义内容片段 */}
                    <div className="space-y-2">
                        <Label htmlFor="custom-content">自定义内容片段</Label>
                        <Textarea
                            id="custom-content"
                            placeholder="可添加自定义消息内容，供推送时使用..."
                            value={message.payload?.custom_content || ''}
                            disabled
                            rows={4}
                            className="resize-none bg-gray-50 dark:bg-gray-800"
                        />
                        <p className="text-xs text-gray-500">
                            自定义内容功能即将推出
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || notes === (message.notes || '')}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                保存中...
                            </>
                        ) : (
                            '保存'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
