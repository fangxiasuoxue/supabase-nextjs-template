export interface CheapIpRuntimeAsset {
  ip?: string | null
  public_ip?: string | null
  connect_ip?: string | null
  socks5_port?: number | null
  auth_username?: string | null
  auth_password?: string | null
}

/** Compile in memory only. The returned object contains credentials and must never be persisted/logged. */
export function compileCheapIpOutbound(
  asset: CheapIpRuntimeAsset,
  tag: string,
  transport: 'direct' | 'gorelay' | 'self_transit' = 'direct',
  localPort?: number,
): Record<string, unknown> {
  const address = transport === 'direct'
    ? (asset.connect_ip || asset.public_ip || asset.ip || '')
    : '127.0.0.1'
  const port = transport === 'direct' ? Number(asset.socks5_port) : Number(localPort)
  if (!address || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cheap IP 缺少可用 SOCKS5 地址/端口')
  if (!asset.auth_username || !asset.auth_password) throw new Error('Cheap IP 缺少 SOCKS5 账密')
  return {
    tag,
    protocol: 'socks',
    settings: {
      servers: [{
        address,
        port,
        users: [{ user: asset.auth_username, pass: asset.auth_password }],
      }],
    },
  }
}
