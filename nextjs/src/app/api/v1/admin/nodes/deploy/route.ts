import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

// POST /api/v1/admin/nodes/deploy — 创建节点部署任务
//
// 修复说明(报告 28-B2):
// 之前这里直接往 node_deployments insert { vps_id, profile_id, deploy_mode, status,
// created_by }。但按 gen types 的真实 schema:
//   - node_deployments 有 node_id(必填)、task_type(必填),没有 vps_id、没有 created_by。
//   - 表单传的 vps_id 实际是 vps_instances.id,而 node_deployments 需要的是 node_id。
// 因此旧写法对真实表必然 500。正确流程是「先建 node,再建 node_deployment」。
//
// 诚实标注(跨仓库,报告 28-B2):
//   本路由只负责把部署任务正确落库,部署记录 status 停在 'pending'。真正驱动部署、
//   把 node_deployments.status 从 pending 推进到 running/success/failed 的消费方
//   (poller)在 jiedian-agent 侧,尚未打通。本次只修 console 侧写路径的 schema
//   正确性,不解决消费方。
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

  // 校验:vps_id(→ nodes.vps_instance_id)+ profile_id 必填
  if (!vps_id || !profile_id) {
    return NextResponse.json({ error: 'vps_id and profile_id are required' }, { status: 400 })
  }

  // 第 1 步:先建 node。
  // node_deployments.node_id 是必填外键,所以要先落一行 nodes 拿到 id。
  // nodes 真实 Insert 列(gen types 确认):必填 name / port / protocol;
  // 可选 vps_instance_id / profile_id / status / created_by / user_id 等。
  // 表单只给了 vps_id + profile_id + deploy_mode,故 name/port 用 provisioning 阶段
  // 的占位默认值(后续由部署消费方按真实分配回填)。
  // 表单参数优先;缺省回退占位(poller 会用这些参数渲染真实 inbound)。
  const nodeName = (node_name && String(node_name).trim()) || `node-${String(vps_id).slice(0, 8)}-${Date.now()}`
  const insertPayload: Record<string, any> = {
    name: nodeName,
    port: Number(port) || 443,
    protocol: 'vless',
    vps_instance_id: vps_id, // 表单的 vps_id 实为 vps_instances.id
    profile_id,
    status: 'provisioning',
    created_by: user.id,
  }
  if (inbound_tag && String(inbound_tag).trim()) insertPayload.inbound_tag = String(inbound_tag).trim()
  // public_ip 现为 text(见 migration 20260816000005),可存落地域名或 IP;poller 用它作分享链接 host。
  if (public_ip && String(public_ip).trim()) insertPayload.public_ip = String(public_ip).trim()
  const { data: nodeRow, error: nodeError } = await adminClient
    .from('nodes')
    .insert(insertPayload)
    .select('id')
    .single()

  if (nodeError) {
    return NextResponse.json({ error: nodeError.message }, { status: 500 })
  }

  // 第 2 步:建 node_deployment,引用刚建的 node_id。
  // 真实必填:node_id、task_type;不要写 vps_id / created_by(列不存在)。
  const { data, error } = await adminClient
    .from('node_deployments')
    .insert({
      node_id: (nodeRow as any).id,
      task_type: 'create',
      profile_id,
      deploy_mode: deploy_mode ?? 'agent_api',
      status: 'pending', // 停在 pending,等 jiedian-agent 侧消费方推进(见文件头标注)
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
