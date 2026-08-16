import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import {
  buildVlessRealityShareUrl,
  buildRenderedConfig,
} from '@/lib/parsers/node-share-builder'

// POST /api/v1/admin/nodes/register-existing
//
// 一键登记「已存在的落地」:把一台已 bare 化、已有 vless-reality 落地 inbound 的 VPS,
// 直接登记成 console node(status=active),立即可订阅 —— 不走 pending / 不依赖 poller。
//
// 与 /api/v1/admin/nodes/deploy(创建部署任务,停在 pending 等消费方)不同:
//   本路由用传入的 reality 参数即时生成 share 链接 + rendered_config + subscribe_token,
//   插入 nodes(active)+ node_deployments(success),订阅端点马上有真实内容。
//
// 幂等:同 name 或同 inbound_tag 的未删除节点已存在 → 409,不重复插入。

const PROFILE_NAME = 'vless-reality-landing'

export async function POST(request: NextRequest) {
  // 鉴权 admin/ops(与 deploy 路由一致)
  const authClient = await createSSRClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: roleData } = await authClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const {
    vps_instance_id,
    name,
    inbound_tag,
    host, // 稳定域名 usN.ibfvps.dpdns.org(或 IP)
    uuid,
    public_key,
    short_id,
    server_name, // reality SNI,默认 yahoo.com
    port, // 落地端口,默认 443
  } = body as Record<string, any>

  // 必填校验
  const missing: string[] = []
  if (!name) missing.push('name')
  if (!inbound_tag) missing.push('inbound_tag')
  if (!host) missing.push('host')
  if (!uuid) missing.push('uuid')
  if (!public_key) missing.push('public_key')
  if (!short_id) missing.push('short_id')
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `缺必填字段: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  const sni = server_name || 'yahoo.com'
  const landingPort = Number(port) > 0 ? Number(port) : 443

  const adminClient = await createServerAdminClient()

  // 幂等:同名或同 inbound_tag 的未删除节点已存在 → 409
  const { data: existing } = await adminClient
    .from('nodes')
    .select('id, name, inbound_tag')
    .or(`name.eq.${name},inbound_tag.eq.${inbound_tag}`)
    .is('deleted_at', null)
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `节点已存在(同 name 或 inbound_tag): ${(existing[0] as any).name}` },
      { status: 409 }
    )
  }

  // 找 vless-reality-landing profile(用于 nodes.profile_id)
  const { data: profile } = await adminClient
    .from('node_profiles')
    .select('id')
    .eq('name', PROFILE_NAME)
    .maybeSingle()
  const profileId = (profile as any)?.id ?? null

  // 生成 share 链接 + rendered_config
  let shareUrl: string
  try {
    shareUrl = buildVlessRealityShareUrl({
      uuid,
      host,
      port: landingPort,
      serverName: sni,
      publicKey: public_key,
      shortId: short_id,
      remark: name,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
  const renderedConfig = buildRenderedConfig([shareUrl])

  // 高熵 subscribe_token
  const subscribeToken = randomBytes(24).toString('hex') // 48 hex chars = 192bit

  // public_ip 列是 inet,不能存域名;仅当 host 是 IP 才写入,否则留空(域名已在 share_links 里)。
  const isIp =
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || /:/.test(host)

  // 第 1 步:插入 node(status=active,立即可订阅)
  const { data: nodeRow, error: nodeError } = await adminClient
    .from('nodes')
    .insert({
      name,
      port: landingPort,
      protocol: 'vless',
      vps_instance_id: vps_instance_id || null,
      profile_id: profileId,
      status: 'active',
      inbound_tag,
      subscribe_token: subscribeToken,
      public_ip: isIp ? host : null,
      remark: isIp ? null : `host=${host}`, // 域名落地时把稳定域名记到 remark 备查
      created_by: user.id,
      last_deployed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (nodeError) {
    return NextResponse.json({ error: nodeError.message }, { status: 500 })
  }

  // 第 2 步:插入 node_deployments(success + 带 rendered_config,供 /sub/[token] 即时提供订阅)
  const { error: depError } = await adminClient
    .from('node_deployments')
    .insert({
      node_id: (nodeRow as any).id,
      task_type: 'create',
      profile_id: profileId,
      deploy_mode: 'agent_api',
      status: 'success',
      rendered_config: renderedConfig as any,
      finished_at: new Date().toISOString(),
    })

  if (depError) {
    // 回滚刚建的 node,避免留下无部署快照的孤儿(订阅会拿不到内容)
    await adminClient.from('nodes').delete().eq('id', (nodeRow as any).id)
    return NextResponse.json({ error: depError.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      data: {
        node_id: (nodeRow as any).id,
        subscribe_token: subscribeToken,
        share_url: shareUrl,
      },
    },
    { status: 201 }
  )
}
