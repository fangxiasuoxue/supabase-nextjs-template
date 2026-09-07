import { NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

async function requireIpManage() {
  const auth = await createSSRClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const admin = await createServerAdminClient()
  const [{ data: role }, { data: permission }] = await Promise.all([
    admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    admin.from('module_permissions').select('can_manage').eq('user_id', user.id).eq('module', 'ip').maybeSingle(),
  ])
  const roleName = (role as { role?: string } | null)?.role
  if (!['admin', 'ops'].includes(roleName || '') && !(permission as { can_manage?: boolean } | null)?.can_manage) {
    return { error: NextResponse.json({ error: 'Forbidden(ip.manage required)' }, { status: 403 }) }
  }
  return { user: { id: user.id }, admin }
}

function normalizeVpsIsp(provider: unknown) {
  const p = String(provider || '').trim().toLowerCase()
  if (!p) return 'Cloud VPS'
  if (['gcp', 'google', 'google-cloud', 'google cloud'].includes(p)) return 'GCP'
  if (['aliyun', 'ali', 'alicloud', 'alibaba cloud'].includes(p)) return 'Aliyun'
  if (['aws', 'amazon', 'amazon web services'].includes(p)) return 'AWS'
  if (p === 'azure' || p === 'microsoft azure') return 'Azure'
  return String(provider).trim()
}

export async function GET() {
  const gate = await requireIpManage()
  if ('error' in gate) return gate.error
  const { data, error } = await gate.admin.from('vps_instances')
    .select('id,name,instance_id,gcp_instance_name,provider,region,zone,status,public_ip,external_ip')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vps: (data ?? []).map((v: any) => ({
    ...v,
    public_ip: v.public_ip ? String(v.public_ip) : (v.external_ip || null),
  })) })
}

export async function POST(req: NextRequest) {
  const gate = await requireIpManage()
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const vpsId = String(body.vps_id || '').trim()
  const label = String(body.label || '').trim().slice(0, 200)
  const usageContext = String(body.usage_context || '').trim().slice(0, 500)
  const proxyType = body.proxy_type ? String(body.proxy_type).toLowerCase() : null
  const port = body.port === '' || body.port == null ? null : Number(body.port)
  if (!vpsId) return NextResponse.json({ error: 'vps_id 必填' }, { status: 400 })
  if (proxyType && !['socks5', 'http', 'https'].includes(proxyType)) {
    return NextResponse.json({ error: '协议只支持 socks5/http/https' }, { status: 400 })
  }
  if ((proxyType && (!Number.isInteger(port) || port! < 1 || port! > 65535)) || (!proxyType && port != null)) {
    return NextResponse.json({ error: '选择协议后必须填写 1-65535 的端口' }, { status: 400 })
  }

  const { data: vps, error: vpsError } = await gate.admin.from('vps_instances')
    .select('id,name,instance_id,gcp_instance_name,provider,region,zone,status,public_ip,external_ip')
    .eq('id', vpsId).maybeSingle()
  if (vpsError) return NextResponse.json({ error: vpsError.message }, { status: 500 })
  if (!vps) return NextResponse.json({ error: 'VPS not found' }, { status: 404 })
  const publicIp = (vps as any).public_ip ? String((vps as any).public_ip) : String((vps as any).external_ip || '')
  if (!publicIp) return NextResponse.json({ error: '该 VPS 没有公网 IP，无法导入' }, { status: 409 })

  const name = label || (vps as any).name || (vps as any).instance_id || (vps as any).gcp_instance_name || publicIp
  const row: any = {
    provider: 'managed-vps', provider_id: vpsId, origin_kind: 'managed_vps', vps_instance_id: vpsId,
    ip: publicIp, public_ip: publicIp, connect_ip: publicIp,
    remark: name, label: name, isp_name: normalizeVpsIsp((vps as any).provider),
    status: String((vps as any).status || '').toUpperCase() === 'RUNNING' ? 'active' : 'inactive',
    ip_version: publicIp.includes(':') ? 'ipv6' : 'ipv4', usage_context: usageContext || null,
    proxy_type: proxyType,
    socks5_port: proxyType === 'socks5' ? port : null,
    http_port: proxyType === 'http' ? port : null,
    https_port: proxyType === 'https' ? port : null,
    last_sync_at: new Date().toISOString(), owner: gate.user.id, created_by: gate.user.id,
  }
  const { data: existing } = await (gate.admin as any).from('ip_assets')
    .select('id').eq('vps_instance_id', vpsId).eq('origin_kind', 'managed_vps').is('deleted_at', null).maybeSingle()
  const query = existing?.id
    ? (gate.admin as any).from('ip_assets').update(row).eq('id', existing.id)
    : (gate.admin as any).from('ip_assets').insert(row)
  const { data, error } = await query.select('id,ip,remark,status,vps_instance_id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data, action: existing?.id ? 'updated' : 'created' }, { status: existing?.id ? 200 : 201 })
}
