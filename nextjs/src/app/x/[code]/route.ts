// GET /x/[code] — 订阅短链别名(故意公开 / PUBLIC ON PURPOSE)
//
// SDD 61 · #8:又短又好记的一条链接 → 302 到通用订阅长链(/sub/*)。
// 客户端跟随 302 时用自身 UA 再请求,最终由 /sub/* 路由按 UA 自动转 Clash/sing-box/Surge/base64。
// 鉴权同 /sub/*:匿名 GET,安全性由短码 + 背后长链的高熵 token 承担;短码本身不含配置。
// 读表走 service_role(绕 RLS);查不到 / target 非 /sub/ 前缀 → 404(不泄露、不造假)。

import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://panel.3pay.top').replace(/\/$/, '')

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!code) return new NextResponse('Not Found', { status: 404 })

  const admin = await createServerAdminClient()
  const { data } = await (admin as any)
    .from('sub_short_links')
    .select('target_path')
    .eq('code', code)
    .maybeSingle()

  const target = (data as { target_path?: string } | null)?.target_path
  // 只允许跳到本站 /sub/* 订阅路径,防开放重定向。
  if (!target || !target.startsWith('/sub/')) {
    return new NextResponse('Not Found', { status: 404 })
  }
  return NextResponse.redirect(`${SITE_URL}${target}`, 302)
}
