'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
    const [selectedBots, setSelectedBots] = useState<string[]>([])
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
                // Default to 'default' if no configs, otherwise select all by default or none
                setSelectedBots(['default'])
            }
        } catch (e) {
            console.error('Failed to load bot configs:', e)
            setSelectedBots(['default'])
        } finally {
            setLoading(false)
        }
    }

    const toggleBot = (botId: string) => {
        setSelectedBots(prev => {
            if (prev.includes(botId)) {
                return prev.filter(id => id !== botId)
            } else {
                return [...prev, botId]
            }
        })
    }

    const handlePush = async () => {
        if (selectedBots.length === 0) {
            toast.error('请至少选择一个推送目标')
            return
        }

        setSending(true)
        let successCount = 0
        let failCount = 0

        try {
            for (const botId of selectedBots) {
                const botKey = botId === 'default'
                    ? 'message.cheap.push.qywxboturl'
                    : `message.cheap.push.qywxboturl.${botId}`

                try {
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
                        throw new Error(data.error || 'Failed')
                    }
                    successCount++
                } catch (e) {
                    console.error(`Failed to push to ${botId}:`, e)
                    failCount++
                }
            }

            if (successCount > 0) {
                toast.success(`成功推送到 ${successCount} 个目标${failCount > 0 ? `，${failCount} 个失败` : ''}`)
                setOpen(false)
                if (onSuccess) onSuccess()
            } else {
                toast.error('推送失败')
            }
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
                            <Label>推送目标 (可多选)</Label>
                            <div className="border rounded-md p-4 space-y-3 max-h-[200px] overflow-y-auto">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="bot-default"
                                        checked={selectedBots.includes('default')}
                                        onCheckedChange={() => toggleBot('default')}
                                    />
                                    <Label htmlFor="bot-default" className="cursor-pointer">默认机器人</Label>
                                </div>
                                {botConfigs.map(config => (
                                    <div key={config.userId} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`bot-${config.userId}`}
                                            checked={selectedBots.includes(config.userId)}
                                            onCheckedChange={() => toggleBot(config.userId)}
                                        />
                                        <Label htmlFor={`bot-${config.userId}`} className="cursor-pointer">
                                            {config.userId}
                                        </Label>
                                    </div>
                                ))}
                            </div>
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
