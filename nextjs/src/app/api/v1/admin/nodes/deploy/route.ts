import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { createNodeWithDeployment, type NodeStore } from '@/lib/nodes/create-node-with-deployment'
import { deriveNodeDefaults } from '@/lib/parsers/node-deploy-defaults'
import { normalizeDeployMode } from '@/lib/nodes/node-lifecycle'

// POST /api/v1/admin/nodes/deploy — 创建节点部署任务(node + node_deployment)
//
// 两个已修 Bug(见 lib/nodes/create-node-with-deployment.ts、lib/parsers/node-deploy-defaults.ts 及其单测):
//  1. 非原子:先建 node 再建 deployment,deployment 失败会留下孤儿 node(status=provisioning)
//     → poller 无 pending 可消费,节点永远卡 provisioning(us8 曾中招)。
//     修复:走 createNodeWithDeployment,deployment 失败即补偿删除 node。
//  2. sitecode 取错:表单曾用 gcp_instance_name(短名 gcp8)推 tag/域名 → jd-land-gcp8 / 不解析域名。
//     修复:服务端按 vps_instances.name(长名 us8-…)派生默认值,表单值缺省时兜底,杜绝 gcp8 脏值。
//
// 诚实标注:本路由只把任务正确落库(deployment 停在 pending);推进 pending→success 的
// 消费方(poller)在 jiedian-agent 侧(已打通,见 docs/current/37)。
export async function POST(request: NextRequest) {
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
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

  const adminClient = await createServerAdminClient()
  const body = await request.json()
  const { vps_id, profile_id, deploy_mode, node_name, port, inbound_tag, public_ip } = body

  if (!vps_id || !profile_id) {
    return NextResponse.json({ error: 'vps_id and profile_id are required' }, { status: 400 })
  }

  // 服务端取 vps 长名派生默认值(权威,防客户端传入短名脏值)。
  const { data: vps } = await adminClient
    .from('vps_instances')
    .select('name, gcp_instance_name')
    .eq('id', vps_id)
    .single()
  const defaults = deriveNodeDefaults((vps as any) ?? {})

  // 表单值优先;缺省用服务端派生默认值(绝不落 gcp8)。
  const nodeName = (node_name && String(node_name).trim()) || defaults.nodeName ||
    `node-${String(vps_id).slice(0, 8)}-${Date.now()}`
  const finalTag = (inbound_tag && String(inbound_tag).trim()) || defaults.inboundTag
  const finalHost = (public_ip && String(public_ip).trim()) || defaults.host

  const nodeInsert: Record<string, unknown> = {
    name: nodeName,
    port: Number(port) || defaults.port || 443,
    protocol: 'vless',
    vps_instance_id: vps_id, // 表单的 vps_id 实为 vps_instances.id
    profile_id,
    status: 'provisioning',
    created_by: user.id,
  }
  if (finalTag) nodeInsert.inbound_tag = finalTag
  if (finalHost) nodeInsert.public_ip = finalHost // public_ip 现为 text,可存域名(migration 20260816000005)

  // 适配 supabase 到纯 NodeStore 接口(编排/补偿逻辑见 lib,单测覆盖)。
  const store: NodeStore = {
    async insertNode(payload) {
      const { data, error } = await adminClient.from('nodes').insert(payload as any).select('id').single()
      return { id: (data as any)?.id, error: error?.message }
    },
    async insertDeployment(payload) {
      const { data, error } = await adminClient.from('node_deployments').insert(payload as any).select('id').single()
      return { id: (data as any)?.id, error: error?.message }
    },
    async deleteNode(id) {
      await adminClient.from('nodes').delete().eq('id', id)
    },
  }

  const result = await createNodeWithDeployment(store, {
    nodeInsert,
    deploymentInsert: {
      task_type: 'create',
      profile_id,
      deploy_mode: normalizeDeployMode(deploy_mode), // 防表单发 'auto'/'manual' 违反 DB check(23514)
      status: 'pending',
    },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(
    { data: { node_id: result.nodeId, deployment_id: result.deploymentId } },
    { status: 201 },
  )
}
