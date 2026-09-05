export interface ManagedNodeDescriptor {
  protocol: 'vless'
  address: string
  port: number
  name: string
  network: string
  security: string
  serverName: string
  fingerprint: string
  publicKey: string
  shortId: string
  flow: string
  encryption: string
}

export function parseManagedNodeShareLink(link: string): ManagedNodeDescriptor {
  const url = new URL(link.trim())
  if (url.protocol !== 'vless:') throw new Error('当前 managed node adapter 仅支持 vless')
  const port = Number(url.port || 443)
  if (!url.username || !url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('vless 分享链接缺少必要连接参数')
  }
  const q = url.searchParams
  const security = q.get('security') || 'none'
  const publicKey = q.get('pbk') || q.get('publicKey') || ''
  const serverName = q.get('sni') || q.get('serverName') || ''
  if (security === 'reality' && (!publicKey || !serverName)) throw new Error('Reality 分享链接缺少 pbk/sni')
  return {
    protocol: 'vless',
    address: url.hostname,
    port,
    name: decodeURIComponent(url.hash.replace(/^#/, '')) || url.hostname,
    network: q.get('type') || 'tcp',
    security,
    serverName,
    fingerprint: q.get('fp') || 'chrome',
    publicKey,
    shortId: q.get('sid') || q.get('shortId') || '',
    flow: q.get('flow') || '',
    encryption: q.get('encryption') || 'none',
  }
}

export function compileManagedNodeOutbound(link: string, tag: string): Record<string, unknown> {
  const d = parseManagedNodeShareLink(link)
  const streamSettings: Record<string, unknown> = { network: d.network, security: d.security }
  if (d.security === 'reality') {
    streamSettings.realitySettings = {
      serverName: d.serverName,
      fingerprint: d.fingerprint,
      publicKey: d.publicKey,
      shortId: d.shortId,
      spiderX: '',
    }
  }
  return {
    tag,
    protocol: 'vless',
    settings: {
      vnext: [{
        address: d.address,
        port: d.port,
        users: [{ id: new URL(link.trim()).username, encryption: d.encryption, flow: d.flow }],
      }],
    },
    streamSettings,
  }
}
