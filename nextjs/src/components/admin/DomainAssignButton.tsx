'use client'

// 分域授权按钮 + 内联弹窗:把某个域名授权给用户(admin 用)。SDD 54 P4。
// mirror components/admin/AssignButton.tsx(节点级),资源键改为域名文本,走 /api/v1/admin/domain-assign。

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserPlus, X, Loader2, Trash2 } from 'lucide-react'

interface Assignment { id: string; user_id: string; email: string | null }
interface UserLite { id: string; email: string; role: string | null }

export function DomainAssignButton({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserLite[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const toggle = (uid: string) => setSel((prev) => {
    const n = new Set(prev)
    n.has(uid) ? n.delete(uid) : n.add(uid)
    return n
  })

  const loadAll = async () => {
    setBusy(true)
    try {
      const [ur, ar] = await Promise.all([
        fetch('/api/users/list').then((r) => r.json()),
        fetch(`/api/v1/admin/domain-assign?domain=${encodeURIComponent(domain)}`).then((r) => r.json()),
      ])
      if (ur?.error) throw new Error(ur.error)
      if (ar?.error) throw new Error(ar.error)
      setUsers(ur.users ?? [])
      setAssignments(ar.assignments ?? [])
    } catch (e: any) {
      toast.error(e.message || '加载失败')
    } finally {
      setBusy(false)
    }
  }

  const openModal = () => { setOpen(true); loadAll() }

  const assign = async () => {
    if (sel.size === 0) return toast.error('先勾选用户')
    setBusy(true)
    try {
      const ids = [...sel]
      const results = await Promise.all(ids.map((uid) =>
        fetch('/api/v1/admin/domain-assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, user_id: uid }),
        }).then((r) => r.ok).catch(() => false),
      ))
      const ok = results.filter(Boolean).length
      const fail = results.length - ok
      if (ok) toast.success(`已授权 ${ok} 个用户${fail ? `,${fail} 个失败` : ''}`)
      else toast.error('授权失败')
      setSel(new Set())
      loadAll()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const revoke = async (userId: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/v1/admin/domain-assign?domain=${encodeURIComponent(domain)}&user_id=${userId}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '撤销失败')
      toast.success('已撤销')
      loadAll()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const assignedIds = new Set(assignments.map((a) => a.user_id))
  const pickable = users.filter((u) => !assignedIds.has(u.id))

  return (
    <>
      <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50 rounded-xl h-9 text-[10px] font-black uppercase tracking-widest" onClick={openModal}>
        <UserPlus className="w-3.5 h-3.5 mr-1.5" />授权给用户
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">授权域名 <span className="font-mono">{domain}</span> 给用户</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div className="mb-3">
              <div className="mb-1 text-xs text-muted-foreground">已授权用户</div>
              {assignments.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">暂无</div>
              ) : (
                <div className="space-y-1">
                  {assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                      <span className="font-mono">{a.email ?? a.user_id}</span>
                      <button onClick={() => revoke(a.user_id)} disabled={busy}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>勾选用户(可多选)</span>
              {pickable.length > 0 && (
                <button className="hover:underline"
                  onClick={() => setSel((prev) => prev.size === pickable.length ? new Set() : new Set(pickable.map((u) => u.id)))}>
                  {sel.size === pickable.length ? '取消全选' : '全选'}
                </button>
              )}
            </div>
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded border p-1">
              {pickable.length === 0 ? (
                <div className="py-2 text-center text-xs text-muted-foreground">无可选用户(都已授权)</div>
              ) : pickable.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} />
                  <span className="font-mono text-xs">{u.email}</span>
                  {u.role ? <span className="text-[10px] text-muted-foreground">({u.role})</span> : null}
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={assign} disabled={busy || sel.size === 0}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `授权选中(${sel.size})`}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              被授权用户(非 admin,需 domain 菜单权限)登录后台域名模块后只见/只详被授权的域名。admin 全见。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
