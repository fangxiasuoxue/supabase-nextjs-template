"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { updateMessageAction } from "@/app/actions/messages"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface MessageEditDialogProps {
    messageId: number
    currentNotes: string | null
    currentIsRead: boolean
    trigger: React.ReactNode
    onSuccess?: () => void
}

export function MessageEditDialog({ messageId, currentNotes, currentIsRead, trigger, onSuccess }: MessageEditDialogProps) {
    const [open, setOpen] = useState(false)
    const [notes, setNotes] = useState(currentNotes || "")
    const [isRead, setIsRead] = useState(currentIsRead)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        try {
            setLoading(true)
            const result = await updateMessageAction(messageId, {
                notes: notes.trim() || undefined,
                is_read: isRead
            })

            if (result.error) {
                toast.error('更新失败: ' + result.error)
            } else {
                toast.success('消息已更新')
                setOpen(false)
                onSuccess?.()
            }
        } catch (e: any) {
            toast.error('更新失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>编辑消息</DialogTitle>
                    <DialogDescription>
                        修改消息的备注和已读状态
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="notes">备注 (自定义内容)</Label>
                        <Textarea
                            id="notes"
                            placeholder="输入自定义备注内容..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={5}
                        />
                        <p className="text-xs text-muted-foreground">
                            此内容将在邮件和企业微信推送中作为自定义内容显示
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="is_read"
                            checked={isRead}
                            onCheckedChange={(checked) => setIsRead(checked as boolean)}
                        />
                        <Label htmlFor="is_read" className="cursor-pointer">
                            标记为已读
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        取消
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
