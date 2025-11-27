'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PushDialogProps {
    messageId: number
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function PushDialog({ messageId, trigger, onSuccess }: PushDialogProps) {
    const [open, setOpen] = useState(false)
    const [sending, setSending] = useState(false)

    const handlePush = async () => {
        setSending(true)
        try {
            const response = await fetch('/api/messages/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId
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
                        Are you sure you want to push this message to the configured WeChat Work bot?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-sm text-muted-foreground bg-muted p-4 rounded-md">
                    The message will be formatted as Markdown and sent to the configured webhook URL.
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                        Cancel
                    </Button>
                    <Button onClick={handlePush} disabled={sending}>
                        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Push
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
