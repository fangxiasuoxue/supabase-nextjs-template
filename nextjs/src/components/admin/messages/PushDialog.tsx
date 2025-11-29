'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getPushConfigsAction } from '@/app/actions/pushConfigs'

interface PushDialogProps {
    messageId: number
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function PushDialog({ messageId, trigger, onSuccess }: PushDialogProps) {
    const [open, setOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const [botConfigs, setBotConfigs] = useState<Array<{ userId: string, botUrl: string }>>([])
    const [selectedBot, setSelectedBot] = useState<string>('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            loadBotConfigs()
        }
    }, [open])

    const loadBotConfigs = async () => {
        setLoading(true)
        try {
            const result = await getPushConfigsAction()
            if (result.data) {
                const configs = result.data.filter(c => c.botUrl)
                setBotConfigs(configs)
                // Default to first config or 'default'
                if (configs.length > 0) {
                    setSelectedBot(configs[0].userId)
                } else {
                    setSelectedBot('default')
                }
            }
        } catch (e) {
            console.error('Failed to load bot configs:', e)
            setSelectedBot('default')
        } finally {
            setLoading(false)
        }
    }

    const handlePush = async () => {
        setSending(true)
        try {
            const botKey = selectedBot === 'default'
                ? 'message.cheap.push.qywxboturl'
                : `message.cheap.push.qywxboturl.${selectedBot}`

            const response = await fetch('/api/messages/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId,
                    bot_key: botKey
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to push message')
            }

            toast.success('Message pushed to WeChat Work')
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" title="Push to WeChat Work">
                        <Send className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Push to WeChat Work</DialogTitle>
                    <DialogDescription>
                        选择推送目标并确认推送
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="bot-select">推送目标</Label>
                            <Select value={selectedBot} onValueChange={setSelectedBot}>
                                <SelectTrigger id="bot-select">
                                    <SelectValue placeholder="选择机器人" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">默认机器人</SelectItem>
                                    {botConfigs.map(config => (
                                        <SelectItem key={config.userId} value={config.userId}>
                                            {config.userId}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            消息将被格式化为 Markdown 并发送到选定的企业微信机器人
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                        取消
                    </Button>
                    <Button onClick={handlePush} disabled={sending || loading}>
                        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        确认推送
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
