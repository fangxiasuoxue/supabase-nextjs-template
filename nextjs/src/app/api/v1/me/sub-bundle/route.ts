import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

// SDD 55 · P4/E6 —— 端用户「我的合订阅」token(惰性铸造)。
// GET:为当前登录用户返回稳定订阅 token(无则铸造);前端据此展示 /sub/u/<token> 合订阅卡。
// 作用域动态:token 只是稳定入口,真正内容由 /sub/u/[token] 按 user 当下被授权的 seat 实时解析。
export async function GET() {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await createServerAdminClient()
  const { data: existing } = await (admin as any)
    .from('user_sub_tokens')
    .select('token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing?.token) return NextResponse.json({ token: existing.token })

  // 铸造 24 字节高熵 token(48 hex,同 subscribe_token 强度)。UNIQUE 冲突极不可能;冲突则回读。
  const token = randomBytes(24).toString('hex')
  const { error: insErr } = await (admin as any)
    .from('user_sub_tokens')
    .insert({ user_id: user.id, token })
  if (insErr) {
    const { data: again } = await (admin as any)
      .from('user_sub_tokens').select('token').eq('user_id', user.id).maybeSingle()
    if (again?.token) return NextResponse.json({ token: again.token })
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }
  return NextResponse.json({ token })
}
