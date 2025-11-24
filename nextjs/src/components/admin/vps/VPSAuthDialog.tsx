'use client'

import { useState, useEffect } from 'react'
import { getNonAdminUsersAction } from '@/app/actions/admin'
import { allocateVPSAction, getVPSAllocationsAction } from '@/app/actions/vps'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface VPSAuthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    vpsId: string
    vpsName: string
}

export function VPSAuthDialog({ open, onOpenChange, vpsId, vpsName }: VPSAuthDialogProps) {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [allocatedUsers, setAllocatedUsers] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (open) {
            loadUsers()
        }
    }, [open])

    const loadUsers = async () => {
        setLoading(true)
        try {
            // Load non-admin users
            const { users: nonAdminUsers, error: usersError } = await getNonAdminUsersAction()
            if (usersError) {
                toast.error('加载用户列表失败: ' + usersError)
                return
            }
            setUsers(nonAdminUsers)

            // Load already allocated users for this VPS instance
            const { allocations, error: allocError } = await getVPSAllocationsAction(vpsId)
            if (allocError) {
                console.error('加载分配记录失败:', allocError)
            } else {
                const allocated = new Set(allocations.map((a: any) => a.owner))
                setAllocatedUsers(allocated)
                setSelectedUsers(allocated)
            }
        } catch (err) {
            toast.error('加载用户列表失败')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleUser = (userId: string) => {
        const newSelected = new Set(selectedUsers)
        if (newSelected.has(userId)) {
            newSelected.delete(userId)
        } else {
            newSelected.add(userId)
        }
        setSelectedUsers(newSelected)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // 为新选中的用户分配此 VPS 实例
            const newAllocations = Array.from(selectedUsers).filter(
                userId => !allocatedUsers.has(userId)
            )

            for (const userId of newAllocations) {
                const { success, error } = await allocateVPSAction(vpsId, userId)
                if (!success) {
                    toast.error(`分配失败: ${error}`)
                    console.error(error)
                }
            }

            if (newAllocations.length > 0) {
                toast.success(`成功分配 ${newAllocations.length} 个用户`)
            } else {
                toast.info('没有新的分配')
            }
            onOpenChange(false)
        } catch (err) {
            toast.error('授权失败')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>VPS 授权 - {vpsName}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            选择要授权访问此 VPS 实例的用户(管理员已自动排除):
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {users.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    没有可授权的用户
                                </div>
                            ) : (
                                users.map(user => (
                                    <div
                                        key={user.id}
                                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                                    >
                                        <Checkbox
                                            id={user.id}
                                            checked={selectedUsers.has(user.id)}
                                            onCheckedChange={() => handleToggleUser(user.id)}
                                        />
                                        <label
                                            htmlFor={user.id}
                                            className="flex-1 text-sm cursor-pointer"
                                        >
                                            {user.email}
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={saving}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving || selectedUsers.size === 0}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    '保存授权'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
