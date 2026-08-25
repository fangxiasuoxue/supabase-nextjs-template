import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { listGrantedVpsIds } from '@/lib/auth/resourceAccess'

// SDD 55 · P2c —— 返回「当前登录用户被分配(vps_allocations state=allocated)的 VPS」。
// 用途:门户判 hasVps(创建部署置灰/删节点护栏文案 R1/R2)+ 部署表单收窄可选 VPS。
// 归属真相 = vps_allocations(P3 统一到 access_grants 后改走 listGrantedResourceIds('vps'))。
// 注:admin/ops 用本接口只会看到「分配给自己」的 VPS(不含全局旁路);他们走完整 VPS 管理页。
export async function GET() {
  const authClient = await createSSRClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ids = await listGrantedVpsIds(user.id)
  if (ids.length === 0) return NextResponse.json({ vps: [], hasVps: false })

  const admin = await createServerAdminClient()
  const { data, error: qErr } = await (admin as any)
    .from('vps_instances')
    .select('id, name, gcp_instance_name, public_ip, external_ip, heartbeat_status, status')
    .in('id', ids)
    .order('name', { ascending: true })
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  const vps = (data ?? []).map((v: any) => ({
    id: v.id,
    name: v.name ?? v.gcp_instance_name ?? null,
    public_ip: v.public_ip ?? v.external_ip ?? null,
    heartbeat_status: v.heartbeat_status ?? null,
    status: v.status ?? null,
  }))
  return NextResponse.json({ vps, hasVps: vps.length > 0 })
}
