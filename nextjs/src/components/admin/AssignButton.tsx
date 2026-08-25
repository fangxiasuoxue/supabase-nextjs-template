'use client'

// 资源授权按钮 + 内联弹窗:把 node / node_client 授权给用户(admin 用)。
// 见 docs/current/53。资源类型 node=节点管理员、node_client=端用户(只看自己 seat)。

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserPlus, X, Loader2, Trash2 } from 'lucide-react'

interface Assignment { id: string; user_id: string; email: string | null; level?: string }
interface UserLite { id: string; email: string; role: string | null }

// SDD 55:node 授权分级。node_client 恒 read(端用户只读)。
type Level = 'read' | 'write' | 'manage'
const LEVEL_LABEL: Record<string, string> = { read: '只读', write: '运营', manage: '管理' }
const LEVEL_HINT: Record<Level, string> = {
  read: '只读:看节点与其终端',
  write: '运营:管终端/发名额/加时长·流量(不碰节点生命周期)',
  manage: '管理:含创建部署/删节点(受 VPS 授权约束)',
}

export function AssignButton({
  resourceType,
  resourceId,
  title,
  compact,
}: {
  resourceType: 'node' | 'node_client'
  resourceId: string
  title: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserLite[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState<Level>(resourceType === 'node' ? 'write' : 'read')
  // D3:二级代理无用户目录(/api/users/list 仅 admin)。目录被拒 → 改用邮箱输入授权。
  const [directoryForbidden, setDirectoryForbidden] = useState(false)
  const [email, setEmail] = useState('')

  const toggle = (uid: string) => setSel((prev) => {
    const n = new Set(prev)
    n.has(uid) ? n.delete(uid) : n.add(uid)
    return n
  })

  const loadAll = async () => {
    setBusy(true)
    try {
      // 用户目录(仅 admin)与已授权列表分开取:目录 403 不阻断——二级代理走邮箱授权。
      const [ur, ar] = await Promise.all([
        fetch('/api/users/list').then((r) => r.json()).catch(() => ({ error: 'forbidden' })),
        fetch(`/api/v1/admin/assign?resource_type=${resourceType}&resource_id=${resourceId}`).then((r) => r.json()),
      ])
      if (ur?.error) {
        setDirectoryForbidden(true)
        setUsers([])
      } else {
        setDirectoryForbidden(false)
        setUsers(ur.users ?? [])
      }
      if (ar?.error) throw new Error(ar.error)
      setAssignments(ar.assignments ?? [])
    } catch (e: any) {
      toast.error(e.message || '加载失败')
    } finally {
      setBusy(false)
    }
  }

  // D3:按邮箱授权(二级代理路径)。后端解析 email→user_id,找不到返回 404。
  const assignByEmail = async () => {
    const val = email.trim()
    if (!val) return toast.error('请输入端用户邮箱')
    setBusy(true)
    try {
      const r = await fetch('/api/v1/admin/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, user_email: val, level }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '授权失败')
      toast.success(`已授权 ${val}`)
      setEmail('')
      loadAll()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const openModal = () => { setOpen(true); loadAll() }

  const assign = async () => {
    if (sel.size === 0) return toast.error('先勾选用户')
    setBusy(true)
    try {
      const ids = [...sel]
      const results = await Promise.all(ids.map((uid) =>
        fetch('/api/v1/admin/assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, user_id: uid, level }),
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
      const r = await fetch(`/api/v1/admin/assign?resource_type=${resourceType}&resource_id=${resourceId}&user_id=${userId}`, { method: 'DELETE' })
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
      <Button variant="ghost" size="sm" className={compact ? 'h-6 justify-start' : ''} onClick={openModal}>
        <UserPlus className="w-3 h-3 mr-1" />授权
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{title}</h3>
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
                      <div className="flex items-center gap-2">
                        {resourceType === 'node' && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {LEVEL_LABEL[a.level ?? 'read']}
                          </span>
                        )}
                        <button onClick={() => revoke(a.user_id)} disabled={busy}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {directoryForbidden && resourceType === 'node' ? (
              // 非 admin 打开节点级授权:node/vps 级授权仅 admin(代理不能转授管理权)。
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                节点管理权的授权仅 admin 可操作。你可在各终端上用「授权」把订阅发给端用户。
              </div>
            ) : directoryForbidden ? (
              // D3 二级代理路径:无用户目录,按邮箱授权端用户。
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">授权给端用户(输入其登录邮箱)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') assignByEmail() }}
                    placeholder="enduser@example.com"
                    className="flex-1 rounded border px-2 py-1 text-sm font-mono"
                  />
                  <Button size="sm" onClick={assignByEmail} disabled={busy || !email.trim()}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '授权'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">对方需已注册账号;授权后其登录即在「我的订阅」看到此终端。</p>
              </div>
            ) : (
              <>
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
              </>
            )}
            {resourceType === 'node' && !directoryForbidden && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">授权级别</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="rounded border px-2 py-1 text-xs"
                >
                  <option value="read">只读</option>
                  <option value="write">运营</option>
                  <option value="manage">管理</option>
                </select>
                <span className="text-[10px] text-muted-foreground">{LEVEL_HINT[level]}</span>
              </div>
            )}
            {!directoryForbidden && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={assign} disabled={busy || sel.size === 0}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `授权选中(${sel.size})`}
                </Button>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {resourceType === 'node'
                ? '被授权用户登录后只看/管这个节点及其终端;能做什么由上面的「授权级别」决定(可对已授权者重设级别=覆盖)。'
                : '被授权用户登录后只看这个终端的订阅/二维码(端用户恒只读)。'}
              作用域生效见 SDD 55。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
