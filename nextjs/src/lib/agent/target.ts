export function agentEnvKey(instanceId: string): string {
  return `JIEDIAN_AGENT_${instanceId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_TOKEN`
}

export function buildAgentBaseUrl(
  vps: { public_ip?: string | null; external_ip?: string | null },
  port = Number(process.env.JIEDIAN_AGENT_PORT || 4948),
): string {
  const address = vps.public_ip || vps.external_ip
  if (!address) throw new Error('VPS has no reachable agent address')
  const host = String(address).includes(':') ? `[${address}]` : address
  return `http://${host}:${port}`
}
