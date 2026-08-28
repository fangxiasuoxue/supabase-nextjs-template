// POST /api/v1/admin/sub-short-links — 为一条订阅长链铸造短码(SDD 61 #8)。
// body { targetPath: "/sub/bundle/<token>" | "/sub/[node]/<token>" | ..., label? }
//   → { code, url }。幂等:同一 targetPath 已有短码则直接返回(不重复建)。
// 鉴权:仅登录管理员(user_roles.role='admin');订阅卡在 admin 页,已受 adminRouteGuard 中间件门。
// 写入走 service_role(绕 RLS)。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://panel.3pay.top').replace(/\/$/, '')
// 只允许订阅路径,防被拿去做开放重定向。
const TARGET_RE = /^\/sub\/(bundle|u|client)\/[A-Za-z0-9._-]+$|^\/sub\/[A-Za-z0-9._-]+$/

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
function genCode(len = 7): string {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length]
  return s
}

export async function POST(req: NextRequest) {
  // 1) 鉴权:登录 + admin
  const authClient = await createSSRClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (!user || authErr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: role } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single()
  if ((role as any)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 2) 参数
  const body = await req.json().catch(() => ({}))
  const targetPath = String(body.targetPath || '').trim()
  const label = body.label ? String(body.label).slice(0, 120) : null
  if (!TARGET_RE.test(targetPath)) {
    return NextResponse.json({ error: '非法 targetPath(须为 /sub/* 订阅路径)' }, { status: 400 })
  }

  const admin = await createServerAdminClient()

  // 3) 幂等:该 targetPath 已有短码则返回
  const { data: existing } = await (admin as any)
    .from('sub_short_links').select('code').eq('target_path', targetPath).maybeSingle()
  if ((existing as any)?.code) {
    const code = (existing as any).code
    return NextResponse.json({ code, url: `${SITE_URL}/x/${code}` })
  }

  // 4) 生成唯一短码(碰撞重试;唯一约束兜底)
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode()
    const { data, error } = await (admin as any)
      .from('sub_short_links')
      .insert({ code, target_path: targetPath, label, created_by: user.id } as any)
      .select('code')
      .maybeSingle()
    if (!error && (data as any)?.code) {
      return NextResponse.json({ code: (data as any).code, url: `${SITE_URL}/x/${(data as any).code}` }, { status: 201 })
    }
    // 23505 = unique_violation:可能 code 撞了(重试),或 target_path 撞了(并发下再查一次返回既有)
    if (error && (error as any).code === '23505') {
      const { data: race } = await (admin as any)
        .from('sub_short_links').select('code').eq('target_path', targetPath).maybeSingle()
      if ((race as any)?.code) {
        return NextResponse.json({ code: (race as any).code, url: `${SITE_URL}/x/${(race as any).code}` })
      }
      continue // code 撞车 → 换一个再试
    }
    if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
  return NextResponse.json({ error: '短码生成多次碰撞,请重试' }, { status: 503 })
}
