// 席位分享链接的节点上下文装配(服务端,带 DB 访问)。
// 供 admin clients 列表、/sub/u、/sub/client、/sub/[token]、/s/[token] 复用;纯生成逻辑见 node-client-admin.ts。
// 一次查 nodes(协议/公网地址/端口/profile)+ node_profiles(SS method)+ node_deployments(vless base 链接),按 node 组装。

import { extractBaseShareLink, ssMethodFromProfile, type SeatLinkNode } from '@/lib/clients/node-client-admin'

export async function loadSeatLinkNodes(admin: any, nodeIds: string[]): Promise<Map<string, SeatLinkNode>> {
  const ids = Array.from(new Set(nodeIds.filter(Boolean)))
  const out = new Map<string, SeatLinkNode>()
  if (ids.length === 0) return out

  const { data: nodes } = await admin
    .from('nodes')
    .select('id, protocol, public_ip, port, profile_id')
    .in('id', ids)

  const profileIds = Array.from(new Set((nodes ?? []).map((n: any) => n.profile_id).filter(Boolean))) as string[]
  const methodByProfile = new Map<string, string>()
  if (profileIds.length > 0) {
    const { data: profiles } = await admin.from('node_profiles').select('id, config_template').in('id', profileIds)
    for (const p of (profiles ?? []) as any[]) methodByProfile.set(p.id, ssMethodFromProfile(p.config_template))
  }

  // 最新带 rendered_config 的部署 → base vless 链接(单节点时 limit 1;多节点取每 node 首条,与 /sub/u 既有口径一致)
  let depQuery = admin
    .from('node_deployments')
    .select('node_id, rendered_config, created_at')
    .in('node_id', ids)
    .not('rendered_config', 'is', null)
    .order('created_at', { ascending: false })
  if (ids.length === 1) depQuery = depQuery.limit(1)
  const { data: deployments } = await depQuery
  const baseByNode = new Map<string, string>()
  for (const d of (deployments ?? []) as any[]) {
    if (baseByNode.has(d.node_id)) continue
    const base = extractBaseShareLink(d.rendered_config)
    if (base) baseByNode.set(d.node_id, base)
  }

  for (const n of (nodes ?? []) as any[]) {
    out.set(n.id, {
      protocol: n.protocol ?? null,
      public_ip: n.public_ip ?? null,
      port: n.port ?? null,
      ss_method: n.profile_id ? methodByProfile.get(n.profile_id) ?? null : null,
      base_link: baseByNode.get(n.id) ?? null,
    })
  }
  return out
}

export async function loadSeatLinkNode(admin: any, nodeId: string): Promise<SeatLinkNode | null> {
  const m = await loadSeatLinkNodes(admin, [nodeId])
  return m.get(nodeId) ?? null
}
