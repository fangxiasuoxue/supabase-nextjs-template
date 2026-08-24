import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────────────────────
// /app/admin/* 服务端路由门(越权修复 B)
//
// 背景:此前 /app/admin/* 只被 AppLayout「按权限隐藏菜单项」保护,而隐藏链接 ≠ 拦
// 访问 —— 普通用户直接敲 URL(如 /app/admin/nodes)仍能渲染整页。本守卫在中间件层
// 对 /app/admin/* 做真正的访问控制,是应用层的纵深;DB 层由各表 RLS 兜底(见
// subscription_bundles / nodes 等策略)。
//
// 权限映射与 AppLayout 侧边栏保持一致(改这里务必同步改 AppLayout,反之亦然):
//   /app/admin/users     → 仅 admin
//   /app/admin/config    → 仅 admin
//   /app/admin/vps       → admin 或 module 'vps'   can_menu
//   /app/admin/alerts    → admin 或 module 'vps'   can_menu(告警中心与 VPS 同权限)
//   /app/admin/nodes     → admin 或 module 'nodes' can_menu(含 /nodes/[id]/*、deploy…)
//   /app/admin/messages  → admin 或 module 'messages' can_menu
//   其它 /app/admin/*     → 默认仅 admin(deny-by-default:新增 admin 页未登记时从严)
//
// admin 判定 = user_roles.role='admin',与 public.is_admin() / checkIsAdmin() 同源。
// 权限读取用「当前登录态(authenticated)」的 supabase 客户端:user_roles /
// module_permissions 均有 *_select_self RLS 策略,允许用户读自己的行。
// ────────────────────────────────────────────────────────────────────────────

type AccessRequirement = { kind: 'admin' } | { kind: 'module'; module: string }

function requirementForPath(pathname: string): AccessRequirement | null {
  if (!pathname.startsWith('/app/admin')) return null

  if (pathname.startsWith('/app/admin/users')) return { kind: 'admin' }
  if (pathname.startsWith('/app/admin/config')) return { kind: 'admin' }
  if (pathname.startsWith('/app/admin/vps')) return { kind: 'module', module: 'vps' }
  if (pathname.startsWith('/app/admin/alerts')) return { kind: 'module', module: 'vps' }
  if (pathname.startsWith('/app/admin/nodes')) return { kind: 'module', module: 'nodes' }
  if (pathname.startsWith('/app/admin/messages')) return { kind: 'module', module: 'messages' }

  // deny-by-default:任何未显式登记的 /app/admin/* 一律按 admin-only 处理。
  return { kind: 'admin' }
}

function denyRedirect(request: NextRequest): NextResponse {
  // 非授权访问 → 弹回主页(/app)。与本文件同目录 middleware 的登录重定向同风格,
  // 刻意 fail-closed:即便权限查询异常,也宁可弹回主页,不放行 admin 页。
  const url = request.nextUrl.clone()
  url.pathname = '/app'
  url.search = ''
  return NextResponse.redirect(url)
}

/**
 * 若当前请求命中受保护的 /app/admin/* 且无权访问,返回重定向 Response;否则返回 null。
 * 调用方(middleware.updateSession)需在 auth.getUser() 之后调用,并把已取到的 user 传入,
 * 避免重复网络往返。
 */
export async function enforceAdminRouteAccess(
  supabase: SupabaseClient,
  request: NextRequest,
  user: User | null,
): Promise<NextResponse | null> {
  const requirement = requirementForPath(request.nextUrl.pathname)
  if (!requirement) return null

  // 未登录的情形由 updateSession 的登录重定向统一处理,这里不重复。
  if (!user) return null

  try {
    // admin 短路:admin 直通所有 /app/admin/*。
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if ((roleRow as { role?: string } | null)?.role === 'admin') return null

    if (requirement.kind === 'admin') {
      return denyRedirect(request)
    }

    // module 型:需要该模块 can_menu(与侧边栏放行条件一致)。
    const { data: perm } = await supabase
      .from('module_permissions')
      .select('can_menu')
      .eq('user_id', user.id)
      .eq('module', requirement.module)
      .maybeSingle()
    if ((perm as { can_menu?: boolean } | null)?.can_menu) return null

    return denyRedirect(request)
  } catch {
    // 权限查询异常 → fail-closed,弹回主页(不放行)。
    return denyRedirect(request)
  }
}
