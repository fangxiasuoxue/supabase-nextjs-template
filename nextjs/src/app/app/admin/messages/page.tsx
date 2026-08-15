"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/lib/context/LanguageContext"
import { useGlobal } from "@/lib/context/GlobalContext"
import { getMessagesAction, updateMessageAction, deleteMessageAction, batchUpdateMessagesAction } from "@/app/actions/messages"
import { checkIsAdmin, getUserPermissionsAction } from "@/app/actions/auth"
import { ExternalMessage, MessageFilter } from "@/types/message"
import { Loader2, RefreshCw, Eye, Edit, Trash2, Mail, Send, CheckCircle, Circle } from "lucide-react"
import { toast } from "sonner"
import { ForwardDialog } from "@/components/admin/messages/ForwardDialog"
import { PushDialog } from "@/components/admin/messages/PushDialog"
import { MessageEditDialog } from "@/components/admin/messages/MessageEditDialog"
import { TemplateManagementDialog } from "@/components/admin/messages/TemplateManagementDialog"
import { PushConfigManagementDialog } from "@/components/admin/messages/PushConfigManagementDialog"
import { EditMessageDialog } from "@/components/admin/messages/EditMessageDialog"

export default function MessagesPage() {
    const { t } = useLanguage()
    const { user } = useGlobal()

    // 筛选条件
    const [filterSource, setFilterSource] = useState("all")
    const [filterEventType, setFilterEventType] = useState("")
    const [filterIsRead, setFilterIsRead] = useState<"all" | "true" | "false">("all")
    const [filterSearch, setFilterSearch] = useState("")

    // 列表状态
    const [messages, setMessages] = useState<ExternalMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const pageSize = 20

    // 选中的消息
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    // 编辑对话框状态
    const [editingMessage, setEditingMessage] = useState<ExternalMessage | null>(null)
    const [showEditDialog, setShowEditDialog] = useState(false)

    // 权限状态
    const [isAdmin, setIsAdmin] = useState(false)
    const [permissions, setPermissions] = useState<any[]>([])
    const [permissionLoaded, setPermissionLoaded] = useState(false)

    // 加载权限
    useEffect(() => {
        async function loadPermissions() {
            try {
                const [admin, perms] = await Promise.all([
                    checkIsAdmin(),
                    getUserPermissionsAction()
                ])
                setIsAdmin(admin)
                setPermissions(perms)
            } catch (e) {
                console.error('Failed to load permissions', e)
            } finally {
                setPermissionLoaded(true)
            }
        }
        if (user?.id) {
            loadPermissions()
        }
    }, [user?.id])

    const canRead = isAdmin || permissions.some(p => p.module === 'messages' && (p.can_read || p.can_write || p.can_manage))
    const canWrite = isAdmin || permissions.some(p => p.module === 'messages' && (p.can_write || p.can_manage))
    const canManage = isAdmin || permissions.some(p => p.module === 'messages' && p.can_manage)

    // 加载消息列表
    const fetchMessages = useCallback(async () => {
        if (!permissionLoaded) return
        if (!canRead) {
            setError("无权访问此页面")
            return
        }

        try {
            setLoading(true)
            setError("")

            const filter: MessageFilter = {
                page: currentPage,
                page_size: pageSize
            }

            if (filterSource && filterSource !== "all") filter.source = filterSource
            if (filterEventType) filter.event_type = filterEventType
            if (filterIsRead !== "all") filter.is_read = filterIsRead === "true"
            if (filterSearch) filter.search = filterSearch

            const result = await getMessagesAction(filter)

            if (result.error) {
                setError(result.error)
                setMessages([])
                setTotalCount(0)
            } else {
                setMessages(result.data)
                setTotalCount(result.total)
            }
        } catch (e: any) {
            setError(e?.message || '加载失败')
            setMessages([])
            setTotalCount(0)
        } finally {
            setLoading(false)
        }
    }, [currentPage, filterSource, filterEventType, filterIsRead, filterSearch])

    // 初始加载和筛选条件变化时重新加载
    useEffect(() => {
        if (user?.id && permissionLoaded) {
            fetchMessages()
        }
    }, [filterSource, filterEventType, filterIsRead, filterSearch, permissionLoaded]) // 依赖筛选条件

    // 清空筛选条件
    const handleClearFilters = () => {
        setFilterSource("all")
        setFilterEventType("")
        setFilterIsRead("all")
        setFilterSearch("")
        setCurrentPage(1)
    }

    // 切换消息已读状态
    const handleToggleRead = async (id: number, currentIsRead: boolean) => {
        if (!canWrite) {
            toast.error('无权执行此操作')
            return
        }
        try {
            const result = await updateMessageAction(id, { is_read: !currentIsRead })
            if (result.error) {
                toast.error('更新失败: ' + result.error)
            } else {
                toast.success(currentIsRead ? '标记为未读' : '标记为已读')
                fetchMessages()
            }
        } catch (e: any) {
            toast.error('更新失败')
        }
    }

    // 编辑消息
    const handleEditMessage = (id: number) => {
        if (!canWrite) {
            toast.error('无权执行此操作')
            return
        }
        const message = messages.find(m => m.id === id)
        if (message) {
            setEditingMessage(message)
            setShowEditDialog(true)
        }
    }

    // 删除消息
    const handleDelete = async (id: number) => {
        if (!canManage) {
            toast.error('无权执行此操作')
            return
        }
        if (!confirm('确定要删除这条消息吗?')) return

        try {
            const result = await deleteMessageAction(id)
            if (result.error) {
                toast.error('删除失败: ' + result.error)
            } else {
                toast.success('删除成功')
                fetchMessages()
            }
        } catch (e: any) {
            toast.error('删除失败')
        }
    }

    // 批量标记已读
    const handleBatchMarkRead = async () => {
        if (!canWrite) {
            toast.error('无权执行此操作')
            return
        }
        if (selectedIds.size === 0) {
            toast.error('请先选择消息')
            return
        }

        try {
            const result = await batchUpdateMessagesAction('mark_read', Array.from(selectedIds))
            if (result.error) {
                toast.error('批量操作失败: ' + result.error)
            } else {
                toast.success(`已标记 ${selectedIds.size} 条消息为已读`)
                setSelectedIds(new Set())
                fetchMessages()
            }
        } catch (e: any) {
            toast.error('批量操作失败')
        }
    }

    // 批量删除
    const handleBatchDelete = async () => {
        if (!canManage) {
            toast.error('无权执行此操作')
            return
        }
        if (selectedIds.size === 0) {
            toast.error('请先选择消息')
            return
        }

        if (!confirm(`确定要删除选中的 ${selectedIds.size} 条消息吗?`)) return

        try {
            const result = await batchUpdateMessagesAction('delete', Array.from(selectedIds))
            if (result.error) {
                toast.error('批量删除失败: ' + result.error)
            } else {
                toast.success(`已删除 ${selectedIds.size} 条消息`)
                setSelectedIds(new Set())
                fetchMessages()
            }
        } catch (e: any) {
            toast.error('批量删除失败')
        }
    }

    // 切换选中状态
    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selectedIds.size === messages.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(messages.map(m => m.id)))
        }
    }

    // 格式化时间
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>消息管理</CardTitle>
                            <CardDescription>管理来自 Proxy-Cheap 的 Webhook 通知消息</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <TemplateManagementDialog />
                            <PushConfigManagementDialog />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* 查询区域 */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">查询条件</h3>
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label>消息来源</Label>
                                <Select value={filterSource} onValueChange={setFilterSource}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="全部来源" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部来源</SelectItem>
                                        <SelectItem value="proxy-cheap">Proxy-Cheap</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>事件类型</Label>
                                <Input
                                    placeholder="输入事件类型"
                                    value={filterEventType}
                                    onChange={(e) => setFilterEventType(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>已读状态</Label>
                                <Select value={filterIsRead} onValueChange={(v: any) => setFilterIsRead(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="true">已读</SelectItem>
                                        <SelectItem value="false">未读</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>关键词搜索</Label>
                                <Input
                                    placeholder="搜索事件类型或备注"
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button onClick={handleClearFilters} variant="outline">
                            清空条件
                        </Button>
                    </div>

                    {/* 操作区域 */}
                    <div className="flex items-center justify-between border-t pt-6">
                        <div className="flex gap-2">
                            {canWrite && (
                                <Button onClick={handleBatchMarkRead} variant="outline" disabled={selectedIds.size === 0}>
                                    批量标记已读
                                </Button>
                            )}
                            {canManage && (
                                <Button onClick={handleBatchDelete} variant="outline" disabled={selectedIds.size === 0}>
                                    批量删除
                                </Button>
                            )}
                        </div>
                        <Button onClick={fetchMessages} variant="outline" disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            刷新
                        </Button>
                    </div>

                    {/* 消息列表 */}
                    <div className="space-y-4 border-t pt-6">
                        <h3 className="text-lg font-semibold">消息列表</h3>
                        {loading && messages.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                            </div>
                        ) : messages.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无消息</p>
                        ) : (
                            <>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">
                                                    <Checkbox
                                                        checked={selectedIds.size === messages.length && messages.length > 0}
                                                        onCheckedChange={toggleSelectAll}
                                                    />
                                                </TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>来源</TableHead>
                                                <TableHead>事件类型</TableHead>
                                                <TableHead>事件ID</TableHead>
                                                <TableHead>接收时间</TableHead>
                                                <TableHead className="text-right">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {messages.map((message) => (
                                                <TableRow key={message.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedIds.has(message.id)}
                                                            onCheckedChange={() => toggleSelect(message.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {message.is_read ? (
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <Circle className="h-4 w-4 text-gray-400" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{message.source}</TableCell>
                                                    <TableCell>{message.event_type}</TableCell>
                                                    <TableCell className="font-mono text-sm">{message.event_id}</TableCell>
                                                    <TableCell>{formatDateTime(message.received_at)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canWrite && (
                                                                <>
                                                                    <MessageEditDialog
                                                                        messageId={message.id}
                                                                        currentNotes={message.notes}
                                                                        currentIsRead={message.is_read}
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" title="编辑">
                                                                                <Edit className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                        onSuccess={fetchMessages}
                                                                    />
                                                                    <ForwardDialog
                                                                        messageId={message.id}
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" title="Forward via Email">
                                                                                <Mail className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <PushDialog
                                                                        messageId={message.id}
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" title="Push to WeChat Work">
                                                                                <Send className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleToggleRead(message.id, message.is_read)}
                                                                        title={message.is_read ? "标记为未读" : "标记为已读"}
                                                                    >
                                                                        {message.is_read ? <Circle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {canManage && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDelete(message.id)}
                                                                    className="text-destructive hover:text-destructive"
                                                                    title="删除"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* 分页 */}
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        共 {totalCount} 条消息,第 {currentPage} / {totalPages} 页
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            上一页
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            下一页
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 编辑消息对话框 */}
            {editingMessage && (
                <EditMessageDialog
                    message={editingMessage}
                    open={showEditDialog}
                    onClose={() => {
                        setShowEditDialog(false)
                        setEditingMessage(null)
                    }}
                    onSave={async (data) => {
                        try {
                            const result = await updateMessageAction(editingMessage.id, data)
                            if (result.error) {
                                toast.error('更新失败: ' + result.error)
                                return false
                            } else {
                                toast.success('更新成功')
                                setShowEditDialog(false)
                                setEditingMessage(null)
                                fetchMessages()
                                return true
                            }
                        } catch (e: any) {
                            toast.error('更新失败')
                            return false
                        }
                    }}
                />
            )}
        </div>
    )
}
