/**
 * GoRelay 平台 API 封装(中转加速模块 · L2=gorelay 供给)。
 *
 * 契约来自 jiedian 仓库 docs/reference/gorelay-api.md 与 runbook
 * 2026-08-26-gorelay-new-platform-poc-us8(§P-B..§P-J 实测校正)。
 *
 * 铁律:
 *  - Bearer token = 全账号权限(能建/删规则、提现),只从 env 读,绝不入库/打日志。
 *  - **必须带非默认 User-Agent**,否则 Cloudflare 403(runbook 实测:默认 urllib/fetch UA 被拦)。
 *  - 现网权威 = GoRelay /tunnel、/node/group/summary;本模块 DB 只登声明,靠对账收敛(59 §7)。
 *  - POST /tunnel 新 schema 必填:load_balance_type / ip_type / ip_limit / max_clients / bandwidth_limit(缺则 400)。
 */

const GORELAY_BASE = process.env.GORELAY_API_BASE || 'https://gorelay.net/api'
const GORELAY_UA = 'Mozilla/5.0 (jiedian-console)'

function apiKey(): string {
  const k = process.env.GORELAY_API_KEY
  if (!k) throw new Error('GORELAY_API_KEY not set')
  return k
}

async function gorelayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GORELAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'User-Agent': GORELAY_UA, // ★ Cloudflare 拦默认 UA
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

// 瞬时抖动重试(runbook 实测:GoRelay API 偶发 000/SSL EOF/慢)
async function withRetry<T>(fn: () => Promise<T>, tries = 4, backoffMs = 1500): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
    }
  }
  throw last
}

export interface ForwardAddress {
  address: string // host:port,如 us8.3pay.top:3900
  weight?: number
}

export interface TunnelSpec {
  name: string
  in_node_group_id: number // 通道(入口线路)
  listen_port: number // pin 的本地口
  forward_addresses: ForwardAddress[] // 单落地 or 多聚合点
  load_balance_type?: 'round' | 'rand' | 'fifo' | 'hash' | 'll' | 'lc'
  // forward 到上游 socks5 时的内置认证——⚠️闭源客户端不支持,cheap 用裸转发+消费端账密(runbook §P-D)
  forward_addresses_protocol?: { type: string; username: string; password: string } | null
  ip_limit?: number
  max_clients?: number
  bandwidth_limit?: number
}

export interface Tunnel {
  id: number
  name: string
  in_node_group_id: number
  listen_port: number | null
  is_port_used?: boolean
  status: string
  forward_addresses: ForwardAddress[]
}

/** GET /user/info —— 账号余额/套餐/流量(P1 监控也可复用) */
export async function getUserInfo(): Promise<any> {
  return withRetry(async () => {
    const r = await gorelayFetch('/user/info')
    if (!r.ok) throw new Error(`user/info ${r.status}`)
    return r.json()
  })
}

/** GET /tunnel —— 现网隧道全表(对账权威) */
export async function listTunnels(): Promise<Tunnel[]> {
  return withRetry(async () => {
    const r = await gorelayFetch('/tunnel')
    if (!r.ok) throw new Error(`list tunnel ${r.status}`)
    const j = await r.json()
    return (j.data ?? j) as Tunnel[]
  })
}

/** GET /node/group/summary —— 线路目录(通道)实拉,勿写死 id */
export async function listNodeGroups(): Promise<any> {
  const r = await gorelayFetch('/node/group/summary')
  if (!r.ok) throw new Error(`node/group/summary ${r.status}`)
  return r.json()
}

/**
 * POST /tunnel —— 建隧道(返回 204 空体;需回读 /tunnel 按 name 找 id)。
 * 补齐新 schema 必填字段;forward_addresses 多元素 + load_balance = 1 隧道扇出 N(聚合)。
 */
export async function createTunnel(spec: TunnelSpec): Promise<void> {
  const body = {
    name: spec.name,
    category: 'port_forward',
    status: 'active',
    tunnel_type: 'relayx',
    load_balance_type: spec.load_balance_type ?? 'round',
    ip_type: 'auto',
    ip_limit: spec.ip_limit ?? 100,
    max_clients: spec.max_clients ?? 5,
    bandwidth_limit: spec.bandwidth_limit ?? 200,
    in_node_group_id: spec.in_node_group_id,
    out_node_group_id: null,
    listen_ip: null,
    listen_port: spec.listen_port,
    proxy_protocol: false,
    forward_addresses: spec.forward_addresses.map((f) => ({ address: f.address, weight: f.weight ?? 1 })),
    listen_protocol: null,
    forward_addresses_protocol: spec.forward_addresses_protocol ?? null,
  }
  await withRetry(async () => {
    const r = await gorelayFetch('/tunnel', { method: 'POST', body: JSON.stringify(body) })
    if (r.status !== 204 && r.status !== 200 && r.status !== 201) {
      throw new Error(`create tunnel ${r.status}: ${(await r.text()).slice(0, 200)}`)
    }
  })
}

/** DELETE /tunnel?ids=a,b —— 回收隧道 */
export async function deleteTunnels(ids: number[]): Promise<void> {
  if (!ids.length) return
  const r = await gorelayFetch(`/tunnel?ids=${ids.join(',')}`, { method: 'DELETE' })
  if (r.status !== 204 && r.status !== 200) throw new Error(`delete tunnel ${r.status}`)
}

/** GET /tunnel/{id}/test —— 两段时延(本地→入口 / 出口→落地),建后校验用 */
export async function testTunnel(id: number): Promise<any> {
  return withRetry(async () => {
    const r = await gorelayFetch(`/tunnel/${id}/test`)
    if (!r.ok) throw new Error(`test tunnel ${r.status}`)
    return r.json()
  })
}

/** DELETE /node?ids= —— 清理陈旧客户端节点(如同名合并残留,runbook §P-G) */
export async function deleteNodes(ids: (number | string)[]): Promise<void> {
  if (!ids.length) return
  const r = await gorelayFetch(`/node?ids=${ids.join(',')}`, { method: 'DELETE' })
  if (r.status !== 204 && r.status !== 200) throw new Error(`delete node ${r.status}`)
}

/** 按 name 找现网 tunnel id(POST 后回读) */
export async function findTunnelIdByName(name: string): Promise<number | null> {
  const list = await listTunnels()
  const t = list.find((x) => x.name === name)
  return t ? t.id : null
}
