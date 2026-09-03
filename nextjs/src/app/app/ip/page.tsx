"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useGlobal } from "@/lib/context/GlobalContext";
import { IpLatencyMatrix } from "@/components/admin/ip/IpLatencyMatrix";
import { ipExpiryStatus, EXPIRY_TONE_CLASS } from "@/lib/ipExpiry";
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
  Zap,
  BarChart3, 
  Layers,
  Terminal,
  Database,
  ArrowRightLeft,
  Plus,
  QrCode
} from "lucide-react";

type IpAsset = {
  id: number
  provider: string
  ip: string
  remark: string | null
  label: string | null
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
  terminate_at_period_end?: boolean | null
  assigned_users?: { id: string, email: string | null, display_name?: string | null, terminate_at_period_end?: boolean | null }[]
  my_allocation?: { id: number, display_name: string | null, notes: string | null, terminate_at_period_end: boolean | null }
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
  const [canWrite, setCanWrite] = useState(false)
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
  const [terminatingIds, setTerminatingIds] = useState<Set<number>>(new Set())
  const [qrAsset, setQrAsset] = useState<IpAsset | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrConfigUrl, setQrConfigUrl] = useState("")

  // 需求:只看待续费(过期≤30天 + 3天内到期)
  const [renewalOnly, setRenewalOnly] = useState(false)

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
  }, [searchRemark, searchIp, searchProviderId, renewalOnly])

  // 格式化流量
  const formatBandwidth = (bytes: number | null) => {
    // 区分 0(实测为 0)与 null/undefined(从未测试)
    if (bytes == null) return "—"
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

  const getProxyPort = (asset: IpAsset) => asset.socks5_port || asset.http_port || asset.https_port || null

  const buildProxyConfigUrl = (asset: IpAsset) => {
    const type = (asset.proxy_type || (asset.socks5_port ? 'socks5' : asset.https_port ? 'https' : 'http')).toLowerCase()
    const port = getProxyPort(asset)
    if (!asset.ip || !port) return ''
    const userInfo = asset.auth_username
      ? `${encodeURIComponent(asset.auth_username)}${asset.auth_password ? `:${encodeURIComponent(asset.auth_password)}` : ''}@`
      : ''
    const name = encodeURIComponent(asset.remark || asset.label || asset.ip)
    if (type === 'socks5') return `socks://${userInfo}${asset.ip}:${port}#${name}`
    return `${type}://${userInfo}${asset.ip}:${port}#${name}`
  }

  const fetchIpAssets = async () => {
    try {
      setLoading(true)
      setError("")
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'read')
      const writePerm = await supabase.hasModulePermission('ip', 'write')
      const managePerm = await supabase.hasModulePermission('ip', 'manage')
      setCanWrite(writePerm.allowed || managePerm.allowed)
      setCanManage(managePerm.allowed)

      if (managePerm.allowed) {
        fetchBalance()
      }

      // Relaxed check: Allow fetch to proceed even if global read is not allowed,
      // relying on RLS to filter assigned IPs for the user.
      // if (!perm.allowed) { ... }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase.getSupabaseClient() as any
      let query = client
        .from('ip_assets')
        .select('*', { count: 'exact' })

      // 应用查询条件 - 只查询未删除的记录
      query = query.is('deleted_at', null)

      // 需求 #2:隐藏过期>30天(DB 层,保证计数/分页/列表一致)。show: 无到期日 OR 到期在30天内
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
      if (renewalOnly) {
        // 只看待续费:到期在 [过期≤30天, 3天内到期] 区间(排除无到期日/远期)
        const threeDaysAhead = new Date(Date.now() + 3 * 86400000).toISOString()
        query = query.gte('expires_at', thirtyDaysAgo).lte('expires_at', threeDaysAhead)
      } else {
        query = query.or(`expires_at.is.null,expires_at.gte.${thirtyDaysAgo}`)
      }

      if (searchRemark) {
        query = query.ilike('remark', `%${searchRemark}%`)
      }
      if (searchIp) {
        query = query.ilike('ip', `%${searchIp}%`)
      }
      if (searchProviderId) {
        query = query.eq('provider_id', searchProviderId)
      }

      // 分页和排序:需求 #2 按到期升序(最紧急在前,无到期日排最后)
      query = query
        .order('expires_at', { ascending: true, nullsFirst: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error

      let rows = ((data as any) || []) as IpAsset[]

      if (rows.length > 0) {
        try {
          if (managePerm.allowed) {
            // 管理员列表展示:该 IP 当前授权给了谁。auth.users 只能服务端列,所以用 /api/users/list 做 id→email 映射。
            const [allocRes, usersRes] = await Promise.all([
              client.from('ip_allocations').select('ip_id, assignee_user_id, state, released_at, display_name, notes, terminate_at_period_end').in('ip_id', rows.map(r => r.id)).eq('state', 'allocated').is('released_at', null),
              fetch('/api/users/list', { credentials: 'same-origin' })
            ])
            const userJson = usersRes.ok ? await usersRes.json() : { users: [] }
            const emailById = new Map<string, string | null>((userJson.users || []).map((u: any) => [String(u.id), u.email || null]))
            const assignedByIp = new Map<number, { id: string, email: string | null, display_name?: string | null, terminate_at_period_end?: boolean | null }[]>()
            ;((allocRes.data as any[]) || []).forEach((a) => {
              if (!a.assignee_user_id) return
              const assigneeId = String(a.assignee_user_id)
              const arr = assignedByIp.get(a.ip_id) || []
              if (!arr.some(x => x.id === assigneeId)) {
                arr.push({ id: assigneeId, email: emailById.get(assigneeId) ?? null, display_name: a.display_name ?? a.notes ?? null, terminate_at_period_end: !!a.terminate_at_period_end })
              }
              assignedByIp.set(a.ip_id, arr)
            })
            rows = rows.map(r => ({ ...r, assigned_users: assignedByIp.get(r.id) || [] }))
            setUsers(userJson.users || [])
          } else {
            // 普通用户:只取自己的授权行,使用 per-user display_name/notes 作为列表显示名与个人停用开关。
            const { data: myAllocs } = await client
              .from('ip_allocations')
              .select('id, ip_id, display_name, notes, terminate_at_period_end')
              .in('ip_id', rows.map(r => r.id))
              .eq('state', 'allocated')
              .is('released_at', null)
            const byIp = new Map<number, { id: number, display_name: string | null, notes: string | null, terminate_at_period_end: boolean | null }>()
            ;((myAllocs as any[]) || []).forEach((a) => byIp.set(a.ip_id, { id: a.id, display_name: a.display_name ?? null, notes: a.notes ?? null, terminate_at_period_end: !!a.terminate_at_period_end }))
            rows = rows.map(r => ({ ...r, my_allocation: byIp.get(r.id) }))
          }
        } catch (e) {
          console.warn('Failed to load ip assignees', e)
        }
      }

      setIpAssets(rows)
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
    // 打开分配对话框时清空上次选择,避免误分配残留
    setSelectedUserIds([])
    setAllocateNotes('')
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
          notes: allocateNotes,
          display_name: allocateNotes
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '分配失败')

      setSelectedUserIds([])
      setAllocateNotes('')
      await fetchIpAssets()
    } catch (e: any) {
      setError(e?.message || '分配失败')
    } finally {
      setLoading(false)
    }
  }

  async function revokeAllocate(userId: string) {
    if (!allocatingId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/ip/allocate?ip_id=${allocatingId}&user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '撤销失败')
      await fetchIpAssets()
    } catch (e: any) {
      setError(e?.message || '撤销失败')
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

  async function openQrDialog(asset: IpAsset) {
    const url = buildProxyConfigUrl(asset)
    if (!url) {
      setError('该 IP 缺少协议/端口，无法生成客户端二维码')
      return
    }
    setQrAsset(asset)
    setQrConfigUrl(url)
    setQrDataUrl(await QRCode.toDataURL(url, { width: 260, margin: 1 }))
  }

  async function handleToggleTerminate(asset: IpAsset, checked: boolean) {
    try {
      setTerminatingIds(prev => new Set(prev).add(asset.id))
      setError("")
      if (canWrite || canManage) {
        const supabase = await createSPASassClient()
        const client = supabase.getSupabaseClient() as any
        const { error } = await client
          .from('ip_assets')
          .update({ terminate_at_period_end: checked })
          .eq('id', asset.id)
        if (error) throw error
        setIpAssets(prev => prev.map(r => r.id === asset.id ? { ...r, terminate_at_period_end: checked } : r))
      } else {
        const res = await fetch('/api/ip/allocate', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip_id: asset.id, terminate_at_period_end: checked })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '更新失败')
        setIpAssets(prev => prev.map(r => r.id === asset.id ? { ...r, my_allocation: r.my_allocation ? { ...r.my_allocation, terminate_at_period_end: checked } : r.my_allocation } : r))
      }
    } catch (e: any) {
      setError(e?.message || '更新终止使用状态失败')
    } finally {
      setTerminatingIds(prev => {
        const next = new Set(prev)
        next.delete(asset.id)
        return next
      })
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // 需求 #2:隐藏过期>30天 + 按到期升序 已下沉到 DB 查询(fetchIpAssets),
  // 保证计数/分页/列表一致;这里直接用。行内到期色标仍由 ipExpiryStatus 计算。
  const visibleAssets = ipAssets
  const allocatingAsset = allocatingId ? ipAssets.find((a) => a.id === allocatingId) : null
  const assignedIdsForDialog = new Set((allocatingAsset?.assigned_users || []).map((u) => u.id))
  const pickableUsersForDialog = users.filter((u) => !assignedIdsForDialog.has(u.id))

  const toggleAllocateUser = (uid: string) => setSelectedUserIds(prev => {
    const next = new Set(prev)
    next.has(uid) ? next.delete(uid) : next.add(uid)
    return Array.from(next)
  })

  const displayNameFor = (asset: IpAsset) => (
    asset.my_allocation?.display_name || asset.my_allocation?.notes || asset.remark || asset.label || (asset.provider_id ? `#${asset.provider_id}` : asset.ip)
  )
  const terminateFor = (asset: IpAsset) => canWrite || canManage ? !!asset.terminate_at_period_end : !!asset.my_allocation?.terminate_at_period_end
  const shouldShowAssetIdentity = canWrite || canManage
  const shouldShowRemarkAssignees = canWrite || canManage
  const tableColumnCount = (shouldShowAssetIdentity ? 1 : 0) + 1 + (shouldShowRemarkAssignees ? 1 : 0) + 3

  // 统计卡真实聚合(基于当前已加载的资产) — Bug #6
  const testedLatencies = ipAssets
    .map(a => a.last_latency_ms)
    .filter((v): v is number => v != null)
  const avgLatency = testedLatencies.length > 0
    ? Math.round(testedLatencies.reduce((s, v) => s + v, 0) / testedLatencies.length)
    : null
  const bandwidthUsedSum = ipAssets.reduce((s, a) => s + (a.bandwidth_used ?? 0), 0)
  const bandwidthTotalSum = ipAssets.reduce((s, a) => s + (a.bandwidth_total ?? 0), 0)
  const bandwidthUsedRatio = bandwidthTotalSum > 0
    ? Math.min(1, Math.max(0, bandwidthUsedSum / bandwidthTotalSum))
    : 0

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
      <TooltipProvider>
        {/* Header / Command Center Info */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 pb-4 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-cyan-600 mb-4 group cursor-default">
              <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-100 group-hover:bg-cyan-100 transition-colors">
                <Terminal className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-600">Edge Network Console</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-widest -mt-0.5">Proxy Asset Management v4.2</span>
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-foreground leading-none">
              IP 资产管理 <span className="text-cyan-600">.</span>
            </h1>
            <p className="text-muted-foreground/80 mt-4 max-w-2xl text-sm font-medium leading-relaxed">
              管理全球分布式代理 IP 资源，实时监控延迟指标、流量配额与资产状态。
              <br className="hidden md:block" />
              集成 Proxy-Cheap API，支持自动化同步与续期。
            </p>
          </div>
          
          {canManage && balance !== null && (
            <div className="glass-card-premium px-8 py-3 rounded-3xl flex flex-col items-end relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-100/50 blur-3xl -mr-8 -mt-8 group-hover:bg-cyan-100 transition-colors" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 relative z-10">Command Funds</span>
              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-sm font-bold text-cyan-600">$</span>
                <span className="text-3xl font-black tech-mono text-cyan-700 tracking-tighter">{balance.toFixed(2)}</span>
              </div>
              <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                  style={{ width: `${(bandwidthUsedRatio * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Grid - Bento Style */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { label: "在线资产", value: ipAssets.filter(a => a.status === 'active').length, sub: "Nodes Active", icon: Globe, color: "text-green-600", bg: "from-green-100 to-transparent" },
            { label: "平均延迟", value: avgLatency != null ? `${avgLatency}ms` : "—", sub: "Tested Avg", icon: Zap, color: "text-amber-600", bg: "from-amber-100 to-transparent" },
            { label: "流量吞吐", value: formatBandwidth(bandwidthUsedSum), sub: "Total Used", icon: BarChart3, color: "text-cyan-600", bg: "from-cyan-100 to-transparent" },
          ].map((stat, i) => (
            <div key={i} className="glass-card-premium p-6 rounded-3xl hover:border-slate-300 group transition-all duration-500 hover:-translate-y-1 overflow-hidden relative">
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${stat.bg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-slate-300 transition-colors ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
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
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 rounded-2xl">
            <AlertDescription className="tech-mono text-xs uppercase">{error}</AlertDescription>
          </Alert>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Controls & Forms */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Search & Management Card */}
            <div className="glass-card-premium p-5 rounded-2xl space-y-5 relative overflow-hidden group/search">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover/search:opacity-10 transition-opacity">
                <Search className="h-24 w-24" />
              </div>

              <div className="flex items-center gap-4 mb-2">
                <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-100">
                  <Search className="h-4 w-4 text-cyan-600" />
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
                    className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all tech-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">IP 地址 / INTERFACE</Label>
                  <Input
                    placeholder="Filter by IP range..."
                    value={searchIp}
                    onChange={(e) => setSearchIp(e.target.value)}
                    className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all tech-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">订单 ID / PROVIDER ID</Label>
                  <Input
                    placeholder="Search source ID..."
                    value={searchProviderId}
                    onChange={(e) => setSearchProviderId(e.target.value)}
                    className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all tech-mono text-sm"
                  />
                </div>
                <Button onClick={handleClearSearch} variant="secondary" className="w-full text-[10px] font-black uppercase tracking-[0.2em] bg-slate-50 hover:bg-slate-100 border-slate-200 rounded-2xl h-12">
                  RESET FILTERS
                </Button>
              </div>

              <div className="pt-8 border-t border-slate-200 flex gap-4 relative z-10">
                {canManage && (
                  <>
                    <Button onClick={handleSync} variant="outline" className="flex-1 border-slate-300 hover:bg-slate-50 rounded-2xl h-12 gap-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-cyan-300" disabled={loading}>
                      <ArrowRightLeft className="h-4 w-4 text-cyan-600" />
                      SYNC
                    </Button>
                    <Button onClick={handleTestAll} variant="outline" className="flex-1 border-slate-300 hover:bg-slate-50 rounded-2xl h-12 gap-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-cyan-300" disabled={loading || isTestingAll}>
                      <Zap className={`h-4 w-4 ${isTestingAll ? 'animate-pulse text-amber-600' : 'text-cyan-600'}`} />
                      {isTestingAll ? 'RUNNING' : 'TEST ALL'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Asset Entry Card (Create/Edit) */}
            <div className="glass-card-premium p-5 rounded-2xl relative overflow-hidden group/entry">
              <div className="absolute top-0 right-0 p-5 opacity-[0.02] group-hover/entry:opacity-10 transition-opacity rotate-12">
                <Plus className="h-32 w-32" />
              </div>
              
              <div className="flex items-center gap-4 mb-5">
                <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-100">
                  <Plus className="h-4 w-4 text-cyan-600" />
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
                      className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">地区代码</Label>
                    <Input
                      placeholder="e.g. US"
                      value={formData.country_code}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600 font-bold tech-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">IP 地址 *</Label>
                  <Input
                    placeholder="0.0.0.0"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20 focus:border-cyan-600 text-cyan-700 font-bold tech-mono text-lg"
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
                      <SelectTrigger className="bg-white border-slate-300 rounded-2xl h-12 focus:ring-cyan-600/20">
                        <SelectValue placeholder="Protocol" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 rounded-2xl">
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
                      className="bg-white border-slate-300 rounded-2xl h-12 tech-mono font-bold"
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
                      className="bg-white border-slate-300 rounded-2xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 ml-1 tracking-widest">验证密码</Label>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={formData.auth_password}
                      onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                      className="bg-white border-slate-300 rounded-2xl h-12"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <Button onClick={handleSave} disabled={loading} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl h-14 font-black uppercase tracking-widest shadow-sm transition-all active:scale-[0.98]">
                    {loading ? 'EXECUTING...' : 'COMMIT CHANGES'}
                  </Button>
                  {(formMode === "edit" || formData.ip) && (
                    <Button onClick={handleCancel} variant="secondary" className="px-6 border border-slate-200 hover:bg-slate-100 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]">
                      ABORT
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Right Column: Asset List */}
          <div className="xl:col-span-2 space-y-6">
            <div className="glass-card-premium rounded-2xl overflow-hidden flex flex-col min-h-[700px]">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-100">
                    <Database className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">资产核心清单</h3>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Global Asset Index</span>
                  </div>
                  <div className="ml-6 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                    <div className="w-1 h-1 rounded-full bg-cyan-600 animate-pulse" />
                    <span className="text-[10px] font-black tech-mono text-cyan-700">
                      {totalCount} RECORDS FOUND
                    </span>
                  </div>
                </div>
                {/* 只看待续费:过期≤30天 + 3天内到期,方便集中续费 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenewalOnly(v => !v)}
                  className={`rounded-xl h-9 text-[10px] font-black uppercase tracking-widest border ${renewalOnly ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'bg-white hover:bg-amber-50 text-amber-700 border-slate-300'}`}
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {renewalOnly ? '显示全部' : '只看待续费'}
                </Button>
              </div>

              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200 hover:bg-transparent h-14">
                      {shouldShowAssetIdentity && <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] pl-8">资产识别 / ATTRIBUTES</TableHead>}
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] pl-8">显示名称 / NAME</TableHead>
                      {shouldShowRemarkAssignees && <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">备注 / 授权用户</TableHead>}
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">遥测数据 / STATUS</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] text-center">地址协议 / INTERFACE</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] text-center">终止使用</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] text-right pr-8">指挥控制 / ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && ipAssets.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={tableColumnCount} className="h-[500px] text-center">
                          <div className="flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-100 blur-2xl animate-pulse rounded-full" />
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-r-2 border-cyan-600 relative z-10"></div>
                            </div>
                            <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">正在建立神经元连接...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : visibleAssets.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={tableColumnCount} className="h-[500px] text-center">
                          <div className="flex flex-col items-center justify-center gap-6 py-20 opacity-30 group cursor-default">
                             <div className="p-6 rounded-full bg-slate-100 border border-slate-200 group-hover:bg-slate-200 transition-colors">
                                <Database className="h-12 w-12" />
                             </div>
                             <span className="text-xs font-black uppercase tracking-[0.3em]">尚未检测到任何活跃资产</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleAssets.map((asset) => (
                        <TableRow key={asset.id} className="border-slate-200 hover:bg-slate-50 transition-all duration-300 group/row h-16">
                          {shouldShowAssetIdentity && (
                            <TableCell className="pl-8 py-3">
                              <div className="flex flex-col gap-1.5">
                                {/* 名称 = proxy-cheap 规范标识(label=US01–US18/VN01,与网页/openwrt 一致);无则回退 provider_id */}
                                <span className="text-sm font-black text-foreground group-hover/row:text-cyan-700 transition-colors uppercase tracking-tight">{asset.label || (asset.provider_id ? `#${asset.provider_id}` : "Legacy Module")}</span>
                                <div className="flex items-center gap-3">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] font-black text-cyan-700 uppercase tracking-widest">
                                    {asset.country_code || "XZ"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tight truncate max-w-[140px]">
                                    {asset.isp_name || "Shadow Network"}
                                  </span>
                                </div>
                                {/* 需求 #2:到期色标(黄=3天内到期 / 红=已过期 / 绿=正常) */}
                                <span className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${EXPIRY_TONE_CLASS[ipExpiryStatus(asset.expires_at).tone]}`}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {ipExpiryStatus(asset.expires_at).label}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="pl-8 py-3 max-w-[220px]">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-sm font-black text-foreground group-hover/row:text-cyan-700 transition-colors tracking-tight break-words">{displayNameFor(asset)}</span>
                              {!shouldShowAssetIdentity && (
                                <span className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${EXPIRY_TONE_CLASS[ipExpiryStatus(asset.expires_at).tone]}`}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {ipExpiryStatus(asset.expires_at).label}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {shouldShowRemarkAssignees && (
                            <TableCell className="py-3 max-w-[240px]">
                              <div className="flex flex-col gap-2">
                                <div className="text-xs font-bold text-slate-700 break-words">
                                  {asset.remark || <span className="text-muted-foreground/40">未填写备注</span>}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(asset.assigned_users || []).length > 0 ? (asset.assigned_users || []).slice(0, 3).map((u) => (
                                    <span key={u.id} className={`px-2 py-0.5 rounded-md border text-[9px] font-black max-w-[180px] truncate ${u.terminate_at_period_end ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                                      {u.display_name ? `${u.display_name} · ` : ''}{u.email || u.id.slice(0, 8)}
                                    </span>
                                  )) : (
                                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase">未授权</span>
                                  )}
                                  {(asset.assigned_users || []).length > 3 && (
                                    <span className="text-[9px] font-black text-blue-600">+{(asset.assigned_users || []).length - 3}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-baseline gap-2">
                                    <div className={`w-2 h-2 rounded-full ${asset.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(asset.status)}`}>
                                      {asset.status || 'OFFLINE'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-1.5">
                                      <Activity className="h-3 w-3 text-muted-foreground/40" />
                                      <span className="tech-mono text-[10px] font-bold text-muted-foreground/80">
                                        {asset.last_latency_ms != null ? `${asset.last_latency_ms}ms` : '—'}
                                      </span>
                                   </div>
                                   <div className="w-[1px] h-3 bg-slate-200" />
                                   <div className="flex items-center gap-1.5">
                                      <Zap className="h-3 w-3 text-muted-foreground/40" />
                                      <span className="tech-mono text-[10px] font-bold text-muted-foreground/80 lowercase">
                                        {asset.last_speed_kbps != null ? `${(asset.last_speed_kbps / 1024).toFixed(1)}mb/s` : '—'}
                                      </span>
                                   </div>
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-4">
                            <div className="inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-100 border border-slate-200 group-hover/row:border-cyan-200 transition-all">
                              <span className="tech-mono text-[11px] text-cyan-700 font-black tracking-tight">{asset.ip}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">{asset.proxy_type || 'TCP'}</span>
                                <span className="tech-mono text-[10px] text-cyan-600 font-black">
                                  {asset.http_port || asset.https_port || asset.socks5_port || "NULL"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-4">
                            <div className="inline-flex flex-col items-center gap-1">
                              <Switch
                                checked={terminateFor(asset)}
                                disabled={terminatingIds.has(asset.id)}
                                onCheckedChange={(checked) => handleToggleTerminate(asset, checked)}
                                className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-green-600"
                              />
                              <span className={`text-[8px] font-black uppercase tracking-widest ${terminateFor(asset) ? 'text-red-600' : 'text-green-600'}`}>
                                {terminateFor(asset) ? '到期停用' : '继续使用'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex gap-2 justify-end opacity-0 group-hover/row:opacity-100 transition-all duration-300 translate-x-4 group-hover/row:translate-x-0">
                              {canWrite && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleTest(asset.id)}
                                        disabled={testingIds.has(asset.id)}
                                        className="h-9 w-9 bg-slate-100 hover:bg-cyan-50 rounded-xl"
                                      >
                                        <Activity className={`h-4 w-4 ${testingIds.has(asset.id) ? 'animate-spin text-cyan-600' : 'text-cyan-600'}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-cyan-700">TELEMETRY_PING</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleEdit(asset)}
                                        className="h-9 w-9 bg-slate-100 hover:bg-slate-200 rounded-xl text-foreground"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-slate-700">RECONFIGURE_ASSET</TooltipContent>
                                  </Tooltip>
                                </>
                              )}

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
                                      className="h-9 w-9 bg-slate-100 hover:bg-amber-50 rounded-xl text-amber-600"
                                    >
                                      <Clock className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-amber-600">EXTEND_LEASE</TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openQrDialog(asset)}
                                    className="h-9 w-9 bg-slate-100 hover:bg-cyan-50 rounded-xl text-cyan-600"
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-cyan-600">CLIENT_QR_IMPORT</TooltipContent>
                              </Tooltip>

                              {canManage && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleAllocate(asset.id)}
                                        className="h-9 w-9 bg-slate-100 hover:bg-blue-50 rounded-xl text-blue-600"
                                      >
                                        <UserPlus className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-blue-600">DELEGATE_ACCESS</TooltipContent>
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
                                        className="h-9 w-9 bg-slate-100 hover:bg-red-50 rounded-xl text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border-slate-200 shadow-sm text-[10px] font-black uppercase text-red-600">PURGE_DATA</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
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
                <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    PAGE {currentPage} OF {totalPages} <span className="mx-2 opacity-20">/</span> {totalCount} RECORDS
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="border-slate-300 hover:bg-slate-50 rounded-lg px-4 text-[10px] font-bold"
                    >
                      PREV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages || loading}
                      className="border-slate-300 hover:bg-slate-50 rounded-lg px-4 text-[10px] font-bold"
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

      {/* Dialogs: Client QR */}
      <Dialog open={!!qrAsset} onOpenChange={(open) => { if (!open) { setQrAsset(null); setQrDataUrl(null); setQrConfigUrl('') } }}>
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-3xl shadow-xl">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">客户端导入二维码</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 flex flex-col items-center">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              {qrDataUrl ? <img src={qrDataUrl} alt="IP客户端二维码" width={260} height={260} className="rounded-lg" /> : null}
            </div>
            <div className="w-full space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">配置链接</Label>
              <textarea
                readOnly
                value={qrConfigUrl}
                className="w-full h-24 rounded-2xl border border-slate-300 bg-slate-50 p-3 text-[11px] tech-mono text-slate-700 break-all"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                用 Shadowrocket / v2rayNG 等客户端扫描。若客户端不识别该直连代理 URI，可手动按链接中的协议、账号、密码、地址和端口填写。
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6 gap-3">
            <Button variant="ghost" className="rounded-2xl h-12 px-6 font-bold text-xs uppercase" onClick={() => { setQrAsset(null); setQrDataUrl(null); setQrConfigUrl('') }}>
              关闭
            </Button>
            <Button className="btn-primary rounded-2xl h-12 px-8 font-bold text-xs uppercase" onClick={() => navigator.clipboard?.writeText(qrConfigUrl)}>
              复制链接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs: Allocation */}
      <Dialog open={showAllocate} onOpenChange={setShowAllocate}>
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-3xl shadow-xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">分配资产接口</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">已授权用户</div>
              {(allocatingAsset?.assigned_users || []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">暂无</div>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto rounded border border-slate-200 p-1">
                  {(allocatingAsset?.assigned_users || []).map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                      <span className="font-mono truncate">{u.email ?? u.id}</span>
                      <button onClick={() => revokeAllocate(u.id)} disabled={loading} className="text-red-500 hover:text-red-700">撤销</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>勾选用户(可多选)</span>
                {pickableUsersForDialog.length > 0 && (
                  <button className="hover:underline"
                    onClick={() => setSelectedUserIds((prev) => prev.length === pickableUsersForDialog.length ? [] : pickableUsersForDialog.map((u) => u.id))}>
                    {selectedUserIds.length === pickableUsersForDialog.length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>
              <div className="max-h-52 space-y-0.5 overflow-y-auto rounded border border-slate-200 p-1">
                {pickableUsersForDialog.length === 0 ? (
                  <div className="py-2 text-center text-xs text-muted-foreground">无可选用户(都已授权)</div>
                ) : pickableUsersForDialog.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleAllocateUser(u.id)} />
                    <span className="font-mono text-xs truncate">{u.email || u.id}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">给被授权用户看到的显示名称</Label>
              <Input
                placeholder="例如: 店铺A专用 / 张三手机 / US稳定线"
                value={allocateNotes}
                onChange={(e) => setAllocateNotes(e.target.value)}
                className="bg-white border-slate-300 rounded-2xl h-12"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 gap-3">
            <Button variant="ghost" className="rounded-2xl h-12 px-6 font-bold text-xs uppercase" onClick={() => setShowAllocate(false)}>
              取消
            </Button>
            <Button className="btn-primary rounded-2xl h-12 px-8 font-bold text-xs uppercase" onClick={confirmAllocate} disabled={loading || selectedUserIds.length === 0}>
              授权选中({selectedUserIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs: Renewal */}
      <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
        <DialogContent className="max-w-sm bg-white border-slate-200 rounded-3xl shadow-xl">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">资产配额续期</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-1 p-4 bg-cyan-50 rounded-2xl border border-cyan-200">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AVAILABLE FUNDS</span>
              <span className="text-2xl font-black tech-mono text-cyan-700">${balance?.toFixed(2) ?? '---'}</span>
            </div>
            
            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 text-center block w-full">选择延长周期 (MONTHS)</Label>
               <div className="grid grid-cols-2 gap-3">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setRenewPeriod(m)}
                      className={`h-12 rounded-2xl border font-black tech-mono text-xs transition-all ${renewPeriod === m ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-slate-50 border-slate-300 text-muted-foreground hover:bg-slate-100'}`}
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
        <AlertDialogContent className="bg-white border-slate-200 rounded-3xl shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-red-600">确认永久删除</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs font-bold leading-relaxed uppercase tracking-wider py-2">
              此操作将从系统中永久移除该 IP 资产的所有关联数据（软删除标记）。此过程在逻辑上是不可逆的。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="shadow-none border-none hover:bg-slate-100 rounded-2xl h-12 font-bold text-xs uppercase" onClick={() => setDeletingId(null)}>CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-12 px-8 font-bold text-xs uppercase border-none">
              PURGE ASSET
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 需求 #3:IP 测速矩阵(源节点 × IP 最新时延) */}
      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-50 rounded-xl border border-cyan-100">
            <Activity className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">IP 测速矩阵</h3>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Latency Matrix — Source Node × IP</span>
          </div>
        </div>
        <IpLatencyMatrix />
      </div>
    </div>
  )
}
