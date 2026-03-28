'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserWithDetails, getUsersAction } from '@/app/actions/admin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RoleSelect } from './RoleSelect'
import { PermissionModal } from './PermissionModal'
import { Loader2, Search, RefreshCw, Users } from 'lucide-react'
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary-400 transition-colors" />
                    <Input
                        placeholder="智能检索用户 (Search ID/Email)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-black/20 border-white/10 rounded-xl h-12 focus:ring-primary-500/50"
                    />
                </div>
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={fetchUsers} 
                    disabled={loading} 
                    className="h-12 w-12 border-white/10 hover:bg-white/5 rounded-xl transition-all active:scale-95"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
                </Button>
            </div>

            <div className="rounded-2xl border border-white/5 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/[0.02]">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-12 pl-6">用户身份 / 邮箱</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-12">权限角色</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-12">创建日期</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-12 text-right pr-6">操作接口</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && users.length === 0 ? (
                            <TableRow className="border-none">
                                <TableCell colSpan={4} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.2em]">正在同步用户数据...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow className="border-none">
                                <TableCell colSpan={4} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-4 opacity-40">
                                        <Users className="h-12 w-12" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.2em]">未匹配到符合条件的用户</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-foreground">{user.email}</span>
                                            <span className="text-[10px] tech-mono text-muted-foreground opacity-50 truncate max-w-[150px]">{user.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="scale-90 origin-left">
                                            <RoleSelect user={user} onUpdate={fetchUsers} />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs tech-mono font-medium text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                            <PermissionModal user={user} onUpdate={fetchUsers} />
                                        </div>
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
