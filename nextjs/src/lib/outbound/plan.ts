export interface DesiredOutboundForPlan {
  id: string
  tag: string
  display_name: string
  deploy_state: string
}

export interface OutboundPlanAction {
  id: string
  tag: string
  display_name: string
  kind: 'create' | 'noop'
}

export function buildOutboundPlan(desired: DesiredOutboundForPlan[], observedTags: Set<string>) {
  const seen = new Set<string>()
  for (const item of desired) {
    if (seen.has(item.tag)) throw new Error(`期望态存在重复 tag: ${item.tag}`)
    seen.add(item.tag)
  }
  const actions: OutboundPlanAction[] = desired.map((item) => ({
    id: item.id, tag: item.tag, display_name: item.display_name,
    kind: observedTags.has(item.tag) ? 'noop' : 'create',
  }))
  return { actions, mutatesRuntime: actions.some((x) => x.kind !== 'noop') }
}

export function buildClientRoute(clientId: string, inboundTag: string, email: string, outboundTag: string) {
  return {
    type: 'field',
    ruleTag: `jiedian-client-${clientId}`,
    inboundTag: [inboundTag],
    user: [email],
    outboundTag,
  }
}

export function safeOutboundSummary(outbound: Record<string, any>) {
  const server = outbound.settings?.vnext?.[0] || outbound.settings?.servers?.[0] || {}
  return {
    tag: outbound.tag || null,
    protocol: outbound.protocol || null,
    address: server.address || null,
    port: server.port || null,
    network: outbound.streamSettings?.network || null,
    security: outbound.streamSettings?.security || null,
  }
}
