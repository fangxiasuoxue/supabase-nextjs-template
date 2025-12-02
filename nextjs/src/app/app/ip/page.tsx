"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, Edit, Clock, UserPlus, Trash2 } from "lucide-react";

type IpAsset = {
  id: number
  provider: string
  ip: string
  remark: string | null
  country_code: string | null
  isp_name: string | null
  provider_id: string | null
  proxy_type: string | null
  http_port: number | null
  https_port: number | null
  socks5_port: number | null
  auth_username: string | null
  auth_password: string | null
  expires_at: string | null
  bandwidth_used: number | null
  bandwidth_total: number | null
  status: string | null
  created_at: string
  deleted_at: string | null
  last_latency_ms: number | null
  last_speed_kbps: number | null
  last_tested_at: string | null
}

type FormData = {
  remark: string
  country_code: string
  isp_name: string
  ip: string
  proxy_type: "socks5" | "http" | "https" | ""
  http_port: string
  https_port: string
  socks5_port: string
  auth_username: string
  auth_password: string
  expires_at: string
  provider: string
}

export default function IpManagementPage() {
  const { t } = useLanguage()
  const { user } = useGlobal()

  // 查询条件
  const [searchRemark, setSearchRemark] = useState("")
  const [searchIp, setSearchIp] = useState("")
  const [searchProviderId, setSearchProviderId] = useState("")

  // 表单状态
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FormData>({
    remark: "",
    country_code: "",
    isp_name: "",
    ip: "",
    proxy_type: "",
    http_port: "",
    https_port: "",
    socks5_port: "",
    auth_username: "",
    auth_password: "",
    expires_at: "",
    provider: "Manual",
  })

  const [canManage, setCanManage] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  // 列表状态
  const [ipAssets, setIpAssets] = useState<IpAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // 分配对话框
  const [allocatingId, setAllocatingId] = useState<number | null>(null)
  const [showAllocate, setShowAllocate] = useState(false)
  const [users, setUsers] = useState<{ id: string, email: string | null }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [allocateNotes, setAllocateNotes] = useState("")

  // 删除确认对话框
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // 续期对话框
  const [renewingId, setRenewingId] = useState<number | null>(null)
  const [showRenewDialog, setShowRenewDialog] = useState(false)
  const [renewPeriod, setRenewPeriod] = useState(1)
  const [renewLoading, setRenewLoading] = useState(false)

  // 测试状态
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set())
  const [isTestingAll, setIsTestingAll] = useState(false)

  // 查询依赖项变化时重新获取数据
  useEffect(() => {
    if (user?.id) {
      fetchIpAssets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentPage])

  // 防抖查询 - 当查询条件变化时延迟查询
  useEffect(() => {
    if (!user?.id) return

    const timeoutId = setTimeout(() => {
      setCurrentPage(1)
      fetchIpAssets()
    }, 300)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRemark, searchIp, searchProviderId])

  // 格式化流量
  const formatBandwidth = (bytes: number | null) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  // 格式化日期时间
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-"
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

  const fetchIpAssets = async () => {
    try {
      setLoading(true)
      setError("")
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'read')
      const managePerm = await supabase.hasModulePermission('ip', 'manage')
      setCanManage(managePerm.allowed)

      if (managePerm.allowed) {
        fetchBalance()
      }

      // Relaxed check: Allow fetch to proceed even if global read is not allowed,
      // relying on RLS to filter assigned IPs for the user.
      // if (!perm.allowed) { ... }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.getSupabaseClient() as any)
        .from('ip_assets')
        .select('*', { count: 'exact' })

      // 应用查询条件 - 只查询未删除的记录
      query = query.is('deleted_at', null)

      if (searchRemark) {
        query = query.ilike('remark', `%${searchRemark}%`)
      }
      if (searchIp) {
        query = query.ilike('ip', `%${searchIp}%`)
      }
      if (searchProviderId) {
        query = query.eq('provider_id', searchProviderId)
      }

      // 分页和排序
      query = query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setIpAssets((data as any) || [])
      setTotalCount(count || 0)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setIpAssets([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }


  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/proxy-cheap/balance')
      if (res.ok) {
        const data = await res.json()
        if (typeof data.balance === 'number') {
          setBalance(data.balance)
        }
      }
    } catch (e) {
      console.error('Failed to fetch balance', e)
    }
  }

  const handleClearSearch = () => {
    setSearchRemark("")
    setSearchIp("")
    setSearchProviderId("")
    setCurrentPage(1)
  }

  const handleCreate = () => {
    setFormMode("create")
    setEditingId(null)
    setFormData({
      remark: "",
      country_code: "",
      isp_name: "",
      ip: "",
      proxy_type: "",
      http_port: "",
      https_port: "",
      socks5_port: "",
      auth_username: "",
      auth_password: "",
      expires_at: "",
      provider: "Manual",
    })
  }

  const handleEdit = (asset: IpAsset) => {
    setFormMode("edit")
    setEditingId(asset.id)

    // 如果有协议类型，直接使用；否则根据端口数据推断
    let proxyType: "socks5" | "http" | "https" | "" = ""

    if (asset.proxy_type) {
      const lowerType = asset.proxy_type.toLowerCase()
      if (lowerType === "socks5" || lowerType === "http" || lowerType === "https") {
        proxyType = lowerType as "socks5" | "http" | "https"
      }
    }

    // 如果协议类型为空，但存在端口数据，自动推断协议类型
    if (!proxyType) {
      if (asset.socks5_port) {
        proxyType = "socks5"
      } else if (asset.https_port) {
        proxyType = "https"
      } else if (asset.http_port) {
        proxyType = "http"
      }
    }

    setFormData({
      remark: asset.remark || "",
      country_code: asset.country_code || "",
      isp_name: asset.isp_name || "",
      ip: asset.ip || "",
      proxy_type: proxyType,
      http_port: asset.http_port?.toString() || "",
      https_port: asset.https_port?.toString() || "",
      socks5_port: asset.socks5_port?.toString() || "",
      auth_username: asset.auth_username || "",
      auth_password: asset.auth_password || "",
      expires_at: asset.expires_at ? new Date(asset.expires_at).toISOString().slice(0, 16) : "",
      provider: asset.provider || "Manual",
    })
    // 滚动到表单区域
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancel = () => {
    setFormMode("create")
    setEditingId(null)
    setFormData({
      remark: "",
      country_code: "",
      isp_name: "",
      ip: "",
      proxy_type: "",
      http_port: "",
      https_port: "",
      socks5_port: "",
      auth_username: "",
      auth_password: "",
      expires_at: "",
      provider: "Manual",
    })
  }

  async function handleSave() {
    if (!formData.ip.trim()) {
      setError("IP地址不能为空")
      return
    }

    try {
      setLoading(true)
      setError("")
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'write')
      if (!perm.allowed) {
        setError("没有写入权限")
        return
      }

      // 构建payload
      const payload: any = {
        ip: formData.ip.trim(),
        remark: formData.remark.trim() || null,
        country_code: formData.country_code.trim() || null,
        isp_name: formData.isp_name.trim() || null,
        auth_username: formData.auth_username.trim() || null,
        auth_password: formData.auth_password.trim() || null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        provider: formData.provider.trim() || "Manual",
      }

      // 处理协议和端口
      if (formData.proxy_type) {
        // 用户明确选择了协议类型，只保存对应的端口
        payload.proxy_type = formData.proxy_type.toLowerCase()
        if (formData.proxy_type === "http") {
          payload.http_port = formData.http_port ? parseInt(formData.http_port) : null
          payload.https_port = null
          payload.socks5_port = null
        } else if (formData.proxy_type === "https") {
          payload.https_port = formData.https_port ? parseInt(formData.https_port) : null
          payload.http_port = null
          payload.socks5_port = null
        } else if (formData.proxy_type === "socks5") {
          payload.socks5_port = formData.socks5_port ? parseInt(formData.socks5_port) : null
          payload.http_port = null
          payload.https_port = null
        }
      } else {
        // 用户没有选择协议类型
        if (formMode === "edit") {
          // 编辑模式下：如果表单中有端口数据，根据端口数据推断协议类型并保留端口数据
          // 这样可以确保即使只改备注，原有的端口数据也不会丢失
          if (formData.socks5_port) {
            payload.proxy_type = "socks5"
            payload.socks5_port = parseInt(formData.socks5_port)
            payload.http_port = null
            payload.https_port = null
          } else if (formData.https_port) {
            payload.proxy_type = "https"
            payload.https_port = parseInt(formData.https_port)
            payload.http_port = null
            payload.socks5_port = null
          } else if (formData.http_port) {
            payload.proxy_type = "http"
            payload.http_port = parseInt(formData.http_port)
            payload.https_port = null
            payload.socks5_port = null
          }
          // 如果表单中没有任何端口数据，不设置这些字段（保持数据库中的原值不变）
        } else {
          // 创建模式下，没有协议类型则所有协议相关字段设为null
          payload.proxy_type = null
          payload.http_port = null
          payload.https_port = null
          payload.socks5_port = null
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase.getSupabaseClient() as any

      if (formMode === "create") {
        const { data: userRes } = await client.auth.getUser()
        const uid = userRes.user?.id
        if (!uid) {
          setError("未登录")
          return
        }
        payload.owner = uid
        const { error } = await client.from('ip_assets').insert(payload)
        if (error) throw error
      } else {
        if (!editingId) return
        const { error } = await client.from('ip_assets').update(payload).eq('id', editingId)
        if (error) throw error
      }

      handleCancel()
      await fetchIpAssets()
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return

    try {
      setLoading(true)
      setError("")
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'manage')
      if (!perm.allowed) {
        setError("没有删除权限")
        return
      }

      // 软删除：设置 deleted_at
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase.getSupabaseClient() as any
      const { error } = await client
        .from('ip_assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingId)

      if (error) throw error

      setShowDeleteDialog(false)
      setDeletingId(null)
      await fetchIpAssets()
    } catch (e: any) {
      setError(e?.message || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleAllocate(id: number) {
    setAllocatingId(id)
    setShowAllocate(true)
    try {
      const res = await fetch('/api/users/list', { credentials: 'same-origin' })
      const json = await res.json()
      if (res.ok) {
        setUsers(json.users || [])
      } else {
        setError(json.error || '加载用户列表失败')
      }
    } catch (e: any) {
      setError(e?.message || '加载用户列表失败')
    }
  }

  async function confirmAllocate() {
    if (!allocatingId || selectedUserIds.length === 0) return

    try {
      setLoading(true)
      const res = await fetch('/api/ip/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_id: allocatingId,
          assignee_user_ids: selectedUserIds,
          notes: allocateNotes
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '分配失败')

      setShowAllocate(false)
      setAllocatingId(null)
      setSelectedUserIds([])
      setAllocateNotes('')
      await fetchIpAssets()
    } catch (e: any) {
      setError(e?.message || '分配失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleRenew() {
    if (!renewingId) return

    try {
      setRenewLoading(true)
      setError("")

      const res = await fetch('/api/proxy-cheap/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: renewingId,
          period: renewPeriod
        })
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || '续期失败')
      }

      setShowRenewDialog(false)
      setRenewingId(null)
      setRenewPeriod(1)

      // 刷新列表和余额
      await fetchIpAssets()
      await fetchBalance()

    } catch (e: any) {
      setError(e?.message || '续期失败')
    } finally {
      setRenewLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  async function handleSync() {
    try {
      setLoading(true)
      const res = await fetch('/api/ip/sync-proxy-cheap', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '同步失败')
      await fetchIpAssets()
    } catch (e: any) {
      setError(e.message || '同步失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(id: number) {
    try {
      setTestingIds(prev => new Set(prev).add(id))
      const res = await fetch('/api/test-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy_ids: [id] })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '测试失败')

      // Update local state and refresh from database
      if (json.results && json.results.length > 0) {
        // Refresh from database to get updated status, latency, and speed
        await fetchIpAssets()
      }
    } catch (e: any) {
      setError(e.message || '测试失败')
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleTestAll() {
    try {
      setIsTestingAll(true)
      // Get all current page IDs or maybe fetch all active IDs?
      // For now, let's just trigger the batch test API which handles finding active proxies
      // But wait, the API requires IDs or we can use GET to test all.
      // Let's use GET /api/test-proxies which tests all active ones (limit 50 by default)
      // Or we can pass all IDs from current view?
      // Requirement says "Test All", usually implies all in DB or all visible.
      // Let's use the GET endpoint we created which defaults to testing active ones.

      const res = await fetch('/api/test-proxies?limit=100', { method: 'GET' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '批量测试失败')

      await fetchIpAssets()
    } catch (e: any) {
      setError(e.message || '批量测试失败')
    } finally {
      setIsTestingAll(false)
    }
  }

  const getStatusColor = (status: string | null) => {
    if (!status) return "text-gray-500"
    if (status === 'active') return "text-green-600"
    if (status === 'unreachable') return "text-red-600"
    return "text-yellow-600"
  }

  return (
    <div className="space-y-6 p-6">
      <TooltipProvider>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>IP管理</CardTitle>
                <CardDescription>管理IP资产，支持查询、创建、编辑和分配</CardDescription>
              </div>
              {canManage && balance !== null && (
                <div className="text-sm font-medium bg-secondary px-4 py-2 rounded-md">
                  当前余额: ${balance.toFixed(2)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 第一部分：查询区域 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">查询条件</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Input
                    placeholder="输入备注进行模糊查询"
                    value={searchRemark}
                    onChange={(e) => setSearchRemark(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IP地址</Label>
                  <Input
                    placeholder="输入IP地址进行查询"
                    value={searchIp}
                    onChange={(e) => setSearchIp(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>订单号</Label>
                  <Input
                    placeholder="输入订单号"
                    value={searchProviderId}
                    onChange={(e) => setSearchProviderId(e.target.value)}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button onClick={handleClearSearch} variant="outline" className="w-full">
                    清空条件
                  </Button>
                </div>
              </div>
            </div>

            {/* 第二部分：表单区域 */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{formMode === "create" ? "创建IP资产" : "编辑IP资产"}</h3>
                {formMode === "create" && (
                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Button onClick={handleTestAll} variant="outline" disabled={loading || isTestingAll}>
                          {isTestingAll ? '测试中...' : '测试全部'}
                        </Button>
                        <Button onClick={handleSync} variant="outline" disabled={loading}>
                          同步
                        </Button>
                      </>
                    )}
                    <Button onClick={handleCreate} variant="outline">
                      新建
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>备注 *</Label>
                  <Input
                    placeholder="给IP取一个独立的名字便于记录"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>国家</Label>
                  <Input
                    placeholder="国家代码，如 CN, US"
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Input
                    value={formData.isp_name}
                    onChange={(e) => setFormData({ ...formData, isp_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>来源 (Provider)</Label>
                  <Input
                    placeholder="来源/供应商标识"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IP地址 *</Label>
                  <Input
                    placeholder="IP地址，必填"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>协议</Label>
                  <Select
                    value={formData.proxy_type}
                    onValueChange={(value: "socks5" | "http" | "https") => setFormData({ ...formData, proxy_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择协议类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.proxy_type === "socks5" && (
                  <div className="space-y-2">
                    <Label>SOCKS5端口</Label>
                    <Input
                      type="number"
                      placeholder="端口号"
                      value={formData.socks5_port}
                      onChange={(e) => setFormData({ ...formData, socks5_port: e.target.value })}
                    />
                  </div>
                )}
                {formData.proxy_type === "http" && (
                  <div className="space-y-2">
                    <Label>HTTP端口</Label>
                    <Input
                      type="number"
                      placeholder="端口号"
                      value={formData.http_port}
                      onChange={(e) => setFormData({ ...formData, http_port: e.target.value })}
                    />
                  </div>
                )}
                {formData.proxy_type === "https" && (
                  <div className="space-y-2">
                    <Label>HTTPS端口</Label>
                    <Input
                      type="number"
                      placeholder="端口号"
                      value={formData.https_port}
                      onChange={(e) => setFormData({ ...formData, https_port: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>用户名</Label>
                  <Input
                    placeholder="认证用户名"
                    value={formData.auth_username}
                    onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>密码</Label>
                  <Input
                    type="password"
                    placeholder="认证密码"
                    value={formData.auth_password}
                    onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>到期时间</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading} className="bg-primary-600 text-white hover:bg-primary-700">
                  保存
                </Button>
                {formMode === "edit" && (
                  <Button onClick={handleCancel} variant="outline" disabled={loading}>
                    取消
                  </Button>
                )}
              </div>
            </div>

            {/* 第三部分：列表区域 */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">IP列表</h3>
              {loading && ipAssets.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : ipAssets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">暂无IP资产</p>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>备注</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>延迟/速度</TableHead>
                          <TableHead>国家</TableHead>
                          <TableHead>供应商ISP</TableHead>
                          <TableHead>订单号</TableHead>
                          <TableHead>IP地址</TableHead>
                          <TableHead>已用流量</TableHead>
                          <TableHead>到期时间</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ipAssets.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell>{asset.remark || "-"}</TableCell>
                            <TableCell>
                              <span className={getStatusColor(asset.status)}>
                                {asset.status || '未知'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{asset.last_latency_ms ? `${asset.last_latency_ms}ms` : '-'}</div>
                                <div>{asset.last_speed_kbps ? `${(asset.last_speed_kbps / 1024).toFixed(2)} MB/s` : '-'}</div>
                              </div>
                            </TableCell>
                            <TableCell>{asset.country_code || "-"}</TableCell>
                            <TableCell>{asset.isp_name || "-"}</TableCell>
                            <TableCell>{asset.provider_id || "-"}</TableCell>
                            <TableCell>{asset.ip}</TableCell>
                            <TableCell>
                              {formatBandwidth(asset.bandwidth_used)}
                              {asset.bandwidth_total && ` / ${formatBandwidth(asset.bandwidth_total)}`}
                            </TableCell>
                            <TableCell>{formatDateTime(asset.expires_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleTest(asset.id)}
                                      disabled={testingIds.has(asset.id)}
                                      className="h-8 w-8"
                                    >
                                      <Activity className={`h-4 w-4 ${testingIds.has(asset.id) ? 'animate-spin' : ''}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>测试连接</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleEdit(asset)}
                                      className="h-8 w-8"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>编辑</p>
                                  </TooltipContent>
                                </Tooltip>

                                {canManage && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setRenewingId(asset.id)
                                          setShowRenewDialog(true)
                                        }}
                                        className="h-8 w-8"
                                      >
                                        <Clock className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>续期</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleAllocate(asset.id)}
                                      className="h-8 w-8"
                                    >
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>分配用户</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setDeletingId(asset.id)
                                        setShowDeleteDialog(true)
                                      }}
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>删除</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        共 {totalCount} 条记录，第 {currentPage} / {totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1 || loading}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages || loading}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* 分配对话框 */}
      <Dialog open={showAllocate} onOpenChange={setShowAllocate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>分配IP资产</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择用户</Label>
              <select
                multiple
                value={selectedUserIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                  setSelectedUserIds(opts)
                }}
                className="w-full border rounded-md p-2 h-40 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email || u.id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">按住Ctrl/Cmd键可多选</p>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                placeholder="分配备注"
                value={allocateNotes}
                onChange={(e) => setAllocateNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllocate(false)}>
              取消
            </Button>
            <Button onClick={confirmAllocate} disabled={loading || selectedUserIds.length === 0}>
              确认分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 续期确认对话框 */}
      <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认续期</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              当前账户余额为: <span className="font-bold">${balance?.toFixed(2) ?? '---'}</span>
            </p>
            <p>
              确定要为该IP续期吗？
            </p>
            <div className="space-y-2">
              <Label>续期时长 (月)</Label>
              <Select
                value={String(renewPeriod)}
                onValueChange={(v) => setRenewPeriod(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1个月</SelectItem>
                  <SelectItem value="3">3个月</SelectItem>
                  <SelectItem value="6">6个月</SelectItem>
                  <SelectItem value="12">12个月</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewDialog(false)}>
              取消
            </Button>
            <Button onClick={handleRenew} disabled={renewLoading}>
              {renewLoading ? '续期中...' : '确认续期'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条IP记录吗？删除后将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
