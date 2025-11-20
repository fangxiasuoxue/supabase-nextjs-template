"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type IpAsset = {
  id: number
  provider: string
  ip: string
  country: string | null
  status: string | null
  created_at: string
}

type Allocation = {
  id: number
  ip_id: number
  assigned_to: string | null
  state: string
  allocated_at: string | null
  released_at: string | null
}

export default function IpManagementPage() {
  const { t } = useLanguage()
  const { user } = useGlobal()
  const [assets, setAssets] = useState<IpAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [allowed, setAllowed] = useState(false)

  const [provider, setProvider] = useState("")
  const [ip, setIp] = useState("")
  const [country, setCountry] = useState("")
  const [status, setStatus] = useState("")

  const [allocatingId, setAllocatingId] = useState<number | null>(null)
  const [assignedTo, setAssignedTo] = useState("")
  const [notes, setNotes] = useState("")
  const [users, setUsers] = useState<{ id: string, email: string | null }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [showAllocate, setShowAllocate] = useState(false)

  useEffect(() => {
    checkPermissionAndLoad()
  }, [user?.id])

  async function checkPermissionAndLoad() {
    try {
      setLoading(true)
      const supabase = await createSPASassClient()
      const { data, error } = await supabase.listIpAssets()
      if (error) throw error
      setAssets(data || [])
      setAllowed(true)
    } catch (e: any) {
      setAllowed(false)
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    try {
      setLoading(true)
      const res = await fetch('/api/ip/sync-proxy-cheap', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      await checkPermissionAndLoad()
    } catch (e: any) {
      setError(e?.message || 'Failed to sync')
    } finally {
      setLoading(false)
    }
  }

  async function openAllocate(id: number) {
    setAllocatingId(id)
    setShowAllocate(true)
    try {
      const res = await fetch('/api/users/list', { credentials: 'same-origin' })
      const json = await res.json()
      if (res.ok) {
        setUsers(json.users || [])
      } else {
        setError(json.error || 'Failed to load users')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
    }
  }

  async function handleCreateAsset() {
    try {
      setLoading(true)
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'write')
      if (!perm.allowed) throw new Error('Not allowed to create')
      const { error } = await supabase.createIpAsset({
        provider,
        ip,
        country: country || null,
        status: status || null,
      })
      if (error) throw error
      setProvider("")
      setIp("")
      setCountry("")
      setStatus("")
      await checkPermissionAndLoad()
    } catch (e: any) {
      setError(e?.message || 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  async function handleAllocate() {
    if (!allocatingId) return
    try {
      setLoading(true)
      const supabase = await createSPASassClient()
      const perm = await supabase.hasModulePermission('ip', 'write')
      if (!perm.allowed) throw new Error('Not allowed to allocate')
      const { error } = await supabase.allocateIp(allocatingId, assignedTo || '', notes || '')
      if (error) throw error
      setAllocatingId(null)
      setAssignedTo("")
      setNotes("")
      await checkPermissionAndLoad()
    } catch (e: any) {
      setError(e?.message || 'Failed to allocate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('ip.title')}</CardTitle>
          <CardDescription>{t('ip.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Input placeholder={t('ip.provider')} value={provider} onChange={(e) => setProvider(e.target.value)} />
              <Input placeholder={t('ip.ip')} value={ip} onChange={(e) => setIp(e.target.value)} />
              <Input placeholder={t('ip.country')} value={country} onChange={(e) => setCountry(e.target.value)} />
              <Input placeholder={t('ip.status')} value={status} onChange={(e) => setStatus(e.target.value)} />
              <Button onClick={handleCreateAsset} disabled={loading} className="bg-primary-600 text-white hover:bg-primary-700">
                {t('ip.create')}
              </Button>
              <Button onClick={handleSync} disabled={loading} className="ml-2 bg-primary-600 text-white hover:bg-primary-700">
                同步
              </Button>
            </div>

            <div className="space-y-2">
              <Input placeholder={t('ip.assignedTo')} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
              <Input placeholder={t('ip.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button onClick={handleAllocate} disabled={loading || !allocatingId} className="bg-primary-600 text-white hover:bg-primary-700">
                {t('ip.allocate')}
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : assets.length === 0 ? (
              <p className="text-muted-foreground">No IP assets</p>
            ) : (
              assets.map((a) => (
                <div key={a.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.provider} · {a.ip}</div>
                    <div className="text-sm text-muted-foreground">{a.country || '-'} · {a.status || '-'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => openAllocate(a.id)} className="bg-primary-50 text-primary-700 hover:bg-primary-100">
                      {t('ip.allocate')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

        </CardContent>
      </Card>
      <Dialog open={showAllocate} onOpenChange={setShowAllocate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ip.allocate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <select multiple value={selectedUserIds} onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
              setSelectedUserIds(opts)
            }} className="w-full border rounded p-2 h-40">
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email || u.id}</option>
              ))}
            </select>
            <Input placeholder={t('ip.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={async () => {
              if (!allocatingId || selectedUserIds.length===0) return
              try {
                setLoading(true)
                const res = await fetch('/api/ip/allocate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_id: allocatingId, assignee_user_ids: selectedUserIds, notes }) })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Allocate failed')
                setShowAllocate(false)
                setSelectedUserIds([])
                setNotes('')
                await checkPermissionAndLoad()
              } catch (e:any) {
                setError(e?.message || 'Allocate failed')
              } finally {
                setLoading(false)
              }
            }} className="bg-primary-600 text-white hover:bg-primary-700">{t('ip.allocate')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}