"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useGlobal } from "@/lib/context/GlobalContext";
import { IpTestDispatcher } from "@/components/admin/ip/IpTestDispatcher";
import { IpTestResultPanel } from "@/components/admin/ip/IpTestResultPanel";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Activity, 
  Edit, 
  Clock, 
  UserPlus, 
  Trash2, 
  Search, 
  Globe, 
  Shield, 
  Zap, 
  BarChart3, 
  Layers,
  Terminal,
  Database,
  ArrowRightLeft,
  Plus
} from "lucide-react";

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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      <TooltipProvider>
        {/* Header / Command Center Info */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-primary-400 mb-4 group cursor-default">
              <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20 group-hover:bg-primary-500/20 transition-colors">
                <Terminal className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary-400/80">Edge Network Console</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-widest -mt-0.5">Proxy Asset Management v4.2</span>
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-foreground leading-none">
              IP 资产管理 <span className="text-primary-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">.</span>
            </h1>
            <p className="text-muted-foreground/80 mt-4 max-w-2xl text-sm font-medium leading-relaxed">
              管理全球分布式代理 IP 资源，实时监控延迟指标、流量配额与资产状态。
              <br className="hidden md:block" />
              集成 Proxy-Cheap API，支持自动化同步与续期。
            </p>
          </div>
          
          {canManage && balance !== null && (
            <div className="glass-card-premium px-8 py-5 rounded-3xl border border-primary-500/20 flex flex-col items-end relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 blur-3xl -mr-8 -mt-8 group-hover:bg-primary-500/10 transition-colors" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 relative z-10">Command Funds</span>
              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-sm font-bold text-primary-500/60">$</span>
                <span className="text-3xl font-black tech-mono text-primary-400 tracking-tighter">{balance.toFixed(2)}</span>
              </div>
              <div className="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 w-3/4 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Grid - Bento Style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "在线资产", value: ipAssets.filter(a => a.status === 'active').length, sub: "Nodes Active", icon: Globe, color: "text-emerald-400", bg: "from-emerald-500/20 to-transparent" },
            { label: "平均延迟", value: "124ms", sub: "Global Avg", icon: Zap, color: "text-amber-400", bg: "from-amber-500/20 to-transparent" },
            { label: "流量吞吐", value: "85GB", sub: "Last 24h", icon: BarChart3, color: "text-primary-400", bg: "from-primary-500/20 to-transparent" },
            { label: "安全防御", value: "1.2k", sub: "Packets Filtered", icon: Shield, color: "text-blue-400", bg: "from-blue-500/20 to-transparent" },
          ].map((stat, i) => (
            <div key={i} className="glass-card-premium p-6 rounded-3xl border border-white/5 hover:border-white/10 group transition-all duration-500 hover:-translate-y-1 overflow-hidden relative">
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${stat.bg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors ${stat.color}`}>
                  <stat.icon className="h-5 w-5 drop-shadow-[0_0_8px_currentColor]" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                    <span className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-tighter">{stat.sub}</span>
                </div>
              </div>
              <div className="text-3xl font-black tech-mono uppercase tracking-tighter relative z-10 group-hover:text-foreground transition-colors">{stat.value}</div>
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 rounded-2xl">
            <AlertDescription className="tech-mono text-xs uppercase">{error}</AlertDescription>
          </Alert>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
          
          {/* Left Column: Controls & Forms */}
          <div className="xl:col-span-1 space-y-10">
            
            {/* Search & Management Card */}
            <div className="glass-card-premium p-8 rounded-[2.5rem] border border-white/5 space-y-8 relative overflow-hidden group/search">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover/search:opacity-10 transition-opacity">
                <Search className="h-24 w-24" />
              </div>

              <div className="flex items-center gap-4 mb-2">
                <div className="p-2.5 bg-primary-500/10 rounded-xl border border-primary-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <Search className="h-4 w-4 text-primary-400" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">智能检索</h3>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Asset Query Engine</span>
                </div>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">备注关键词 / REMARK</Label>
                  <Input
                    placeholder="Filter by identifier..."
                    value={searchRemark}
                    onChange={(e) => setSearchRemark(e.target.value)}
                    className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-500/40 focus:border-primary-500/40 transition-all tech-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">IP 地址 / INTERFACE</Label>
                  <Input
                    placeholder="Filter by IP range..."
                    value={searchIp}
                    onChange={(e) => setSearchIp(e.target.value)}
                    className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-500/40 focus:border-primary-500/40 transition-all tech-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">订单 ID / PROVIDER ID</Label>
                  <Input
                    placeholder="Search source ID..."
                    value={searchProviderId}
                    onChange={(e) => setSearchProviderId(e.target.value)}
                    className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-500/40 focus:border-primary-500/40 transition-all tech-mono text-sm"
                  />
                </div>
                <Button onClick={handleClearSearch} variant="secondary" className="w-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/[0.03] hover:bg-white/5 border-white/5 rounded-2xl h-12">
                  RESET FILTERS
                </Button>
              </div>

              <div className="pt-8 border-t border-white/5 flex gap-4 relative z-10">
                {canManage && (
                  <>
                    <Button onClick={handleSync} variant="outline" className="flex-1 border-white/10 hover:bg-white/5 rounded-2xl h-12 gap-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-primary-500/30" disabled={loading}>
                      <ArrowRightLeft className="h-4 w-4 text-primary-400" />
                      SYNC
                    </Button>
                    <Button onClick={handleTestAll} variant="outline" className="flex-1 border-white/10 hover:bg-white/5 rounded-2xl h-12 gap-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-primary-500/30" disabled={loading || isTestingAll}>
                      <Zap className={`h-4 w-4 ${isTestingAll ? 'animate-pulse text-amber-400' : 'text-primary-400'}`} />
                      {isTestingAll ? 'RUNNING' : 'TEST ALL'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Asset Entry Card (Create/Edit) */}
            <div className="glass-card-premium p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group/entry shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover/entry:opacity-10 transition-opacity rotate-12">
                <Plus className="h-32 w-32" />
              </div>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="p-2.5 bg-primary-500/10 rounded-xl border border-primary-500/20">
                  <Plus className="h-4 w-4 text-primary-400" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">
                      {formMode === "create" ? "资产入库" : "资产修订"}
                    </h3>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Manual Provisioning</span>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">资产标识 *</Label>
                    <Input
                      placeholder="Remark"
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-400/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">地区代码</Label>
                    <Input
                      placeholder="e.g. US"
                      value={formData.country_code}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-400/30 font-bold tech-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">IP 地址 *</Label>
                  <Input
                    placeholder="0.0.0.0"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary/40 text-primary font-bold tech-mono text-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">传输协议</Label>
                    <Select
                      value={formData.proxy_type}
                      onValueChange={(value: "socks5" | "http" | "https") => setFormData({ ...formData, proxy_type: value })}
                    >
                      <SelectTrigger className="bg-black/40 border-white/5 rounded-2xl h-12 focus:ring-primary-400/30">
                        <SelectValue placeholder="Protocol" />
                      </SelectTrigger>
                      <SelectContent className="bg-secondary/95 backdrop-blur-2xl border-white/10 rounded-2xl">
                        <SelectItem value="socks5" className="font-bold tech-mono">SOCKS5</SelectItem>
                        <SelectItem value="http" className="font-bold tech-mono">HTTP</SelectItem>
                        <SelectItem value="https" className="font-bold tech-mono">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">端口</Label>
                    <Input
                      type="number"
                      placeholder="Port"
                      value={formData.proxy_type === "socks5" ? formData.socks5_port : formData.proxy_type === "http" ? formData.http_port : formData.https_port}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (formData.proxy_type === "socks5") setFormData({ ...formData, socks5_port: val });
                        else if (formData.proxy_type === "http") setFormData({ ...formData, http_port: val });
                        else if (formData.proxy_type === "https") setFormData({ ...formData, https_port: val });
                      }}
                      className="bg-black/40 border-white/5 rounded-2xl h-12 tech-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">验证账号</Label>
                    <Input
                      placeholder="Username"
                      value={formData.auth_username}
                      onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })}
                      className="bg-black/40 border-white/5 rounded-2xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">验证密码</Label>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={formData.auth_password}
                      onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                      className="bg-black/40 border-white/5 rounded-2xl h-12"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <Button onClick={handleSave} disabled={loading} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-14 font-black uppercase tracking-widest shadow-[0_10px_30px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98]">
                    {loading ? 'EXECUTING...' : 'COMMIT CHANGES'}
                  </Button>
                  {(formMode === "edit" || formData.ip) && (
                    <Button onClick={handleCancel} variant="secondary" className="px-6 border border-white/5 hover:bg-white/5 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]">
                      ABORT
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Right Column: Asset List */}
          <div className="xl:col-span-2 space-y-6">
            <div className="glass-card-premium rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col min-h-[700px] shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
              <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.1)]">
                    <Database className="h-5 w-5 text-primary-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">资产核心清单</h3>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Global Asset Index</span>
                  </div>
                  <div className="ml-6 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                    <div className="w-1 h-1 rounded-full bg-primary-500 animate-pulse" />
                    <span className="text-[10px] font-black tech-mono text-primary-400/80">
                      {totalCount} RECORDS FOUND
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader className="bg-white/[0.01]">
                    <TableRow className="border-white/5 hover:bg-transparent h-14">
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] pl-8">资产识别 / ATTRIBUTES</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">遥测数据 / STATUS</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] text-center">地址协议 / INTERFACE</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] text-right pr-8">指挥控制 / ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && ipAssets.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={4} className="h-[500px] text-center">
                          <div className="flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary-500/20 blur-2xl animate-pulse rounded-full" />
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-r-2 border-primary-500 relative z-10"></div>
                            </div>
                            <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">正在建立神经元连接...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : ipAssets.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={4} className="h-[500px] text-center">
                          <div className="flex flex-col items-center justify-center gap-6 py-20 opacity-30 group cursor-default">
                             <div className="p-6 rounded-full bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                                <Database className="h-12 w-12" />
                             </div>
                             <span className="text-xs font-black uppercase tracking-[0.3em]">尚未检测到任何活跃资产</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      ipAssets.map((asset) => (
                        <TableRow key={asset.id} className="border-white/5 hover:bg-white/[0.03] transition-all duration-300 group/row h-20">
                          <TableCell className="pl-8 py-5">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-sm font-black text-foreground group-hover/row:text-primary-400 transition-colors uppercase tracking-tight">{asset.remark || "Legacy Module"}</span>
                              <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded-md bg-secondary border border-white/5 text-[9px] font-black text-primary/80 uppercase tracking-widest">
                                  {asset.country_code || "XZ"}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tight truncate max-w-[140px]">
                                  {asset.isp_name || "Shadow Network"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-baseline gap-2">
                                    <div className={`w-2 h-2 rounded-full ${asset.status === 'active' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-zinc-700'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(asset.status)}`}>
                                      {asset.status || 'OFFLINE'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-1.5">
                                      <Activity className="h-3 w-3 text-muted-foreground/40" />
                                      <span className="tech-mono text-[10px] font-bold text-muted-foreground/80">
                                        {asset.last_latency_ms ? `${asset.last_latency_ms}ms` : '---'}
                                      </span>
                                   </div>
                                   <div className="w-[1px] h-3 bg-white/5" />
                                   <div className="flex items-center gap-1.5">
                                      <Zap className="h-3 w-3 text-muted-foreground/40" />
                                      <span className="tech-mono text-[10px] font-bold text-muted-foreground/80 lowercase">
                                        {asset.last_speed_kbps ? `${(asset.last_speed_kbps / 1024).toFixed(1)}mb/s` : '---'}
                                      </span>
                                   </div>
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-4">
                            <div className="inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-black/20 border border-white/5 group-hover/row:border-primary-500/20 transition-all">
                              <span className="tech-mono text-[11px] text-primary-400 font-black tracking-tight">{asset.ip}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">{asset.proxy_type || 'TCP'}</span>
                                <span className="tech-mono text-[10px] text-primary-500/60 font-black">
                                  {asset.http_port || asset.https_port || asset.socks5_port || "NULL"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex gap-2 justify-end opacity-0 group-hover/row:opacity-100 transition-all duration-300 translate-x-4 group-hover/row:translate-x-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleTest(asset.id)}
                                    disabled={testingIds.has(asset.id)}
                                    className="h-9 w-9 bg-white/5 hover:bg-primary-500/10 rounded-xl"
                                  >
                                    <Activity className={`h-4 w-4 ${testingIds.has(asset.id) ? 'animate-spin text-primary-400' : 'text-primary-400'}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-secondary-950 border-white/10 text-[10px] font-black uppercase text-primary-400">TELEMETRY_PING</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEdit(asset)}
                                    className="h-9 w-9 bg-white/5 hover:bg-white/10 rounded-xl text-foreground"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-secondary-950 border-white/10 text-[10px] font-black uppercase">RECONFIGURE_ASSET</TooltipContent>
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
                                      className="h-9 w-9 bg-white/5 hover:bg-amber-500/10 rounded-xl text-amber-500"
                                    >
                                      <Clock className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-secondary-950 border-white/10 text-[10px] font-black uppercase text-amber-400">EXTEND_LEASE</TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleAllocate(asset.id)}
                                    className="h-9 w-9 bg-white/5 hover:bg-blue-500/10 rounded-xl text-blue-400"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-secondary-950 border-white/10 text-[10px] font-black uppercase text-blue-400">DELEGATE_ACCESS</TooltipContent>
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
                                    className="h-9 w-9 bg-white/5 hover:bg-red-500/10 rounded-xl text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-secondary-950 border-white/10 text-[10px] font-black uppercase text-red-400">PURGE_DATA</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    PAGE {currentPage} OF {totalPages} <span className="mx-2 opacity-20">/</span> {totalCount} RECORDS
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="border-white/10 hover:bg-white/5 rounded-lg px-4 text-[10px] font-bold"
                    >
                      PREV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages || loading}
                      className="border-white/10 hover:bg-white/5 rounded-lg px-4 text-[10px] font-bold"
                    >
                      NEXT
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* Dialogs: Allocation */}
      <Dialog open={showAllocate} onOpenChange={setShowAllocate}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">分配资产接口</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">目标用户列表 (Multiselect)</Label>
              <select
                multiple
                value={selectedUserIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                  setSelectedUserIds(opts)
                }}
                className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 h-48 text-sm focus:ring-primary-500/50 scrollbar-hide outline-none tech-mono"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="p-2 mb-1 rounded-lg hover:bg-white/5">
                    {u.email || u.id}
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-muted-foreground uppercase font-bold text-right tracking-widest">Hold CTRL/CMD for Multiple</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">同步备注说明</Label>
              <Input
                placeholder="Assign notes..."
                value={allocateNotes}
                onChange={(e) => setAllocateNotes(e.target.value)}
                className="bg-black/20 border-white/5 rounded-2xl h-12"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 gap-3">
            <Button variant="ghost" className="rounded-2xl h-12 px-6 font-bold text-xs uppercase" onClick={() => setShowAllocate(false)}>
              取消
            </Button>
            <Button className="btn-primary rounded-2xl h-12 px-8 font-bold text-xs uppercase" onClick={confirmAllocate} disabled={loading || selectedUserIds.length === 0}>
              确认资产分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs: Renewal */}
      <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
        <DialogContent className="max-w-sm bg-card/95 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">资产配额续期</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-1 p-4 bg-primary-500/10 rounded-2xl border border-primary-500/20">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AVAILABLE FUNDS</span>
              <span className="text-2xl font-black tech-mono text-primary-400">${balance?.toFixed(2) ?? '---'}</span>
            </div>
            
            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 text-center block w-full">选择延长周期 (MONTHS)</Label>
               <div className="grid grid-cols-2 gap-3">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setRenewPeriod(m)}
                      className={`h-12 rounded-2xl border font-black tech-mono text-xs transition-all ${renewPeriod === m ? 'bg-primary-500 border-primary-500 text-primary-950' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}`}
                    >
                      {m} MON
                    </button>
                  ))}
               </div>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-3">
            <Button variant="ghost" className="w-full rounded-2xl h-12 font-bold text-xs uppercase" onClick={() => setShowRenewDialog(false)}>
              ABORT
            </Button>
            <Button className="btn-primary w-full rounded-2xl h-12 font-bold text-xs uppercase" onClick={handleRenew} disabled={renewLoading}>
              {renewLoading ? 'PROCESSING...' : 'CONFIRM RENEWAL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs: Purge Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-red-400">确认永久删除</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs font-bold leading-relaxed uppercase tracking-wider py-2">
              此操作将从系统中永久移除该 IP 资产的所有关联数据（软删除标记）。此过程在逻辑上是不可逆的。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="shadow-none border-none hover:bg-white/5 rounded-2xl h-12 font-bold text-xs uppercase" onClick={() => setDeletingId(null)}>CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white rounded-2xl h-12 px-8 font-bold text-xs uppercase border-none">
              PURGE ASSET
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase-2: Agent 测试结果面板 */}
      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Agent 测试结果</h3>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Test Results via jiedian-agent</span>
          </div>
        </div>
        <IpTestResultPanel />
      </div>
    </div>
  )
}
