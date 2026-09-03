'use client'

import { useState, useEffect } from 'react'
import { getNonAdminUsersAction } from '@/app/actions/admin'
import { allocateVPSAction, getVPSAllocationsAction, releaseVPSAction } from '@/app/actions/vps'
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
    const [allocations, setAllocations] = useState<any[]>([])

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
                setAllocations(allocations)
                setAllocatedUsers(allocated)
                setSelectedUsers(new Set())
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
            // 为新勾选的用户分配此 VPS 实例(已授权用户不再出现在待选列表)
            const newAllocations = Array.from(selectedUsers)

            for (const userId of newAllocations) {
                const { success, error } = await allocateVPSAction(vpsId, userId)
                if (!success) {
                    toast.error(`分配失败: ${error}`)
                    console.error(error)
                }
            }

            if (newAllocations.length > 0) {
                toast.success(`成功分配 ${newAllocations.length} 个用户`)
                setSelectedUsers(new Set())
                await loadUsers()
            } else {
                toast.info('没有新的分配')
            }
        } catch (err) {
            toast.error('授权失败')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const revoke = async (allocationId: string) => {
        setSaving(true)
        try {
            const { success, error } = await releaseVPSAction(allocationId)
            if (!success) throw new Error(error || '撤销失败')
            toast.success('已撤销')
            await loadUsers()
        } catch (err: any) {
            toast.error(err?.message || '撤销失败')
        } finally {
            setSaving(false)
        }
    }

    const pickableUsers = users.filter((u) => !allocatedUsers.has(u.id))
    const selectAllPickable = () => setSelectedUsers((prev) => prev.size === pickableUsers.length ? new Set() : new Set(pickableUsers.map((u) => u.id)))

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
                            选择要授权访问此 VPS 实例的用户(管理员已自动排除，可一次勾选多人):
                        </div>

                        <div>
                            <div className="mb-1 text-xs text-muted-foreground">已授权用户</div>
                            {allocations.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-1">暂无</div>
                            ) : (
                                <div className="space-y-1 max-h-28 overflow-y-auto rounded border p-1">
                                    {allocations.map((a: any) => {
                                        const u = users.find((x) => x.id === a.owner || x.id === a.assigned_to)
                                        return (
                                            <div key={a.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                                                <span className="font-mono truncate">{u?.email || a.owner || a.assigned_to}</span>
                                                <button onClick={() => revoke(a.id)} disabled={saving} className="text-red-500 hover:text-red-700 shrink-0">撤销</button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>勾选用户(可多选)</span>
                                {pickableUsers.length > 0 && (
                                    <button className="hover:underline" onClick={selectAllPickable}>
                                        {selectedUsers.size === pickableUsers.length ? '取消全选' : '全选'}
                                    </button>
                                )}
                            </div>
                            <div className="max-h-52 overflow-y-auto space-y-1 rounded border p-1">
                                {pickableUsers.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        没有可授权的用户
                                    </div>
                                ) : (
                                    pickableUsers.map(user => (
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
                                                className="flex-1 text-sm cursor-pointer font-mono truncate"
                                            >
                                                {user.email}
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
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
                                    `授权选中(${selectedUsers.size})`
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
