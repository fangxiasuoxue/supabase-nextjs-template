'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateUserRoleAction, UserWithDetails } from '@/app/actions/admin'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface RoleSelectProps {
    user: UserWithDetails
    onUpdate: () => void
}

export function RoleSelect({ user, onUpdate }: RoleSelectProps) {
    const [loading, setLoading] = useState(false)

    const handleRoleChange = async (newRole: string) => {
        if (newRole === user.role) return

        setLoading(true)
        try {
            const { error } = await updateUserRoleAction(user.id, newRole)
            if (error) {
                toast.error(error)
            } else {
                toast.success('Role updated')
                onUpdate()
            }
        } catch {
            toast.error('Failed to update role')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            <Select
                defaultValue={user.role}
                onValueChange={handleRoleChange}
                disabled={loading}
            >
                <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
