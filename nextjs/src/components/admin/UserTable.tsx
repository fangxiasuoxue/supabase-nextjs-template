'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserWithDetails, getUsersAction } from '@/app/actions/admin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RoleSelect } from './RoleSelect'
import { PermissionModal } from './PermissionModal'
import { Loader2, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export function UserTable() {
    const [users, setUsers] = useState<UserWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page] = useState(1)

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await getUsersAction(page, 50, search)
            if (error) {
                toast.error(error)
            } else {
                setUsers(data)
            }
        } catch {
            toast.error('Failed to fetch users')
        } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchUsers()
        }, 500)
        return () => clearTimeout(timer)
    }, [fetchUsers])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Permissions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No users found
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <RoleSelect user={user} onUpdate={fetchUsers} />
                                    </TableCell>
                                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <PermissionModal user={user} onUpdate={fetchUsers} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
