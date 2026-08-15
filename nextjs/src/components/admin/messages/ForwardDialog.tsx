'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Mail, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getUsersAction } from '@/app/actions/admin'

interface ForwardDialogProps {
    messageId: number
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function ForwardDialog({ messageId, trigger, onSuccess }: ForwardDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [users, setUsers] = useState<{ id: string, email: string }[]>([])
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')

    // Load users when dialog opens
    useEffect(() => {
        if (open) {
            loadUsers()
        }
    }, [open])

    const loadUsers = async () => {
        setLoading(true)
        try {
            // Fetch users (using existing admin action)
            // Note: getUsersAction returns paginated data, we might want a simpler list for this
            // But for now let's use what we have, maybe fetch first 50
            const { data, error } = await getUsersAction(1, 50, search)
            if (error) {
                toast.error('Failed to load users')
            } else {
                setUsers(data.map(u => ({ id: u.id, email: u.email })))
            }
        } catch (e) {
            console.error(e)
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        // Debounce could be added here
    }

    // Reload when search changes (simple implementation)
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                loadUsers()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [search])

    const toggleUser = (userId: string) => {
        const newSelected = new Set(selectedUsers)
        if (newSelected.has(userId)) {
            newSelected.delete(userId)
        } else {
            newSelected.add(userId)
        }
        setSelectedUsers(newSelected)
    }

    const handleForward = async () => {
        if (selectedUsers.size === 0) {
            toast.error('Please select at least one user')
            return
        }

        setSending(true)
        try {
            const response = await fetch('/api/messages/forward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId,
                    user_ids: Array.from(selectedUsers)
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to forward message')
            }

            toast.success(`Message forwarded to ${data.sent_count} users`)
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
                    <Button variant="ghost" size="icon" title="Forward via Email">
                        <Mail className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Forward Message</DialogTitle>
                    <DialogDescription>
                        Select users to forward this message to via email.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={handleSearch}
                            className="flex-1"
                        />
                    </div>
                    <div className="border rounded-md h-[200px] overflow-y-auto p-2 space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : users.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No users found</p>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm">
                                    <Checkbox
                                        id={`user-${user.id}`}
                                        checked={selectedUsers.has(user.id)}
                                        onCheckedChange={() => toggleUser(user.id)}
                                    />
                                    <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                                        {user.email}
                                    </Label>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Selected: {selectedUsers.size} users
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                        Cancel
                    </Button>
                    <Button onClick={handleForward} disabled={sending || selectedUsers.size === 0}>
                        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Email
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
