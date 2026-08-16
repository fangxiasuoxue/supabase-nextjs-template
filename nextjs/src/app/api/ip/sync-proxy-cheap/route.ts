import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function POST() {
  // W1 鉴权门:此前无鉴权,任何人可触发 service-role 同步/覆写 IP 资产(含明文密码)。
  const authClient = await createSSRClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: roleData } = await authClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = process.env.PROXY_CHEAP_API_KEY
  const secret = process.env.PROXY_CHEAP_API_SECRET
  const admin = await createServerAdminClient()
  const now = new Date().toISOString()

  async function upsertFromList(list: any[], sourceUrl: string, providerLabel: string) {
    // 过期代理 API 返回 publicIp=null,但过期前是有 IP 的。先捞库里已知 IP,
    // null 时保留旧值,避免 upsert 用 null 覆盖掉过期前的 IP(否则续费时看不到是哪个)。
    const { data: existingRows } = await admin
      .from('ip_assets')
      .select('provider_id, ip, public_ip, connect_ip, label')
      .eq('provider', providerLabel)
    const existingById = new Map<string, any>()
    for (const r of (existingRows as any[]) ?? []) existingById.set(String(r.provider_id), r)

    // 跳过 CANCELED(永久注销,无续费意义);ACTIVE + EXPIRED 都入库
    const rows = list.filter((p: any) => String(p.status ?? '').toUpperCase() !== 'CANCELED').map((p: any) => {
      const conn = p.connection || {}
      const auth = p.authentication || {}
      const meta = p.metadata || {}
      const prev = existingById.get(String(p.id ?? ''))
      // API 有值优先;为 null(过期)时回退到库里已知 IP,再回退 connectIp
      const publicIp = conn.publicIp ?? p.publicIp ?? p.ip
        ?? prev?.public_ip ?? prev?.ip ?? conn.connectIp ?? prev?.connect_ip ?? null
      // 规范资产标识 = proxy-cheap 网页"名称"列 = API note(US01–US18/VN01)。
      // 过期代理 note 可能为空,回退到库里已知 label,避免被 null 覆盖(与 IP 同策略)。
      const label = (p.note != null && String(p.note).trim() !== '')
        ? String(p.note).trim()
        : (prev?.label ?? null)
      return {
        provider: providerLabel,
        provider_id: String(p.id ?? ''),
        label,
        status: p.status ?? null,
        network_type: p.networkType ?? null,
        country_code: p.countryCode ?? null,
        proxy_type: p.proxyType ?? null,
        ip_version: conn.ipVersion ?? null,
        public_ip: publicIp,
        ip: publicIp,
        connect_ip: conn.connectIp ?? null,
        http_port: conn.httpPort ?? null,
        https_port: conn.httpsPort ?? null,
        socks5_port: conn.socks5Port ?? null,
        auth_username: auth.username ?? null,
        auth_password: auth.password ?? null,
        isp_name: meta.ispName ?? null,
        order_id: meta.orderId ?? null,
        bandwidth_total: (p.bandwidth && p.bandwidth.total) ?? null,
        bandwidth_used: (p.bandwidth && p.bandwidth.used) ?? null,
        routes: Array.isArray(p.routes) ? p.routes : [],
        expires_at: p.expiresAt ?? null,
        created_at: p.createdAt ?? null,
        last_sync_at: now,
        source_url: sourceUrl,
        source_raw: p,
        // Bug #4 修复:供应商 API 里仍存在的 IP = 活的。upsert 命中软删行时显式复活,
        // 否则记录复活却仍带旧 deleted_at,列表 is('deleted_at', null) 会将其过滤成「僵尸行」。
        deleted_at: null,
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // 去重键 = provider_id(proxy 稳定 id);过期代理 publicIp=null,用 public_ip 去重会乱。
    const { error } = await admin.from('ip_assets').upsert(rows as any, { onConflict: 'provider,provider_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 清理下线:/services/proxies 已返回 active+expired 全量,所以「provider_id 不在本次响应里」
    // = 该代理已从账户彻底移除(或被 CANCELED 过滤掉)→ 软删。过期的仍在响应里(EXPIRED),不会被误删。
    // 仅在响应非空时清理(防 API 空/错时误删全部)。
    const activeIds = rows.map((r) => r.provider_id).filter(Boolean)
    let purged = 0
    if (activeIds.length > 0) {
      const inList = `(${activeIds.map((id) => `"${id}"`).join(',')})`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: purgedRows } = await admin.from('ip_assets' as any)
        .update({ deleted_at: now })
        .eq('provider', providerLabel)
        .is('deleted_at', null)
        .not('provider_id', 'in', inList)
        .select('id')
      purged = (purgedRows as any[])?.length ?? 0
    }
    return NextResponse.json({ count: rows.length, purged })
  }

  if (key && secret) {
    // 正确端点:/services/proxies 返回 active+expired(老 /proxies 只返回 active,看不到过期的)。
    // perPage=100 一页取全(当前账户 ~48;若增长超 100 需分页)。
    const url = 'https://api.proxy-cheap.com/services/proxies?page=1&perPage=100'
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Api-Key': key, 'X-Api-Secret': secret } })
      if (!res.ok) {
        console.error('ProxyCheap API error:', res.status, res.statusText)
        return NextResponse.json({ error: `Upstream error: ${res.status} ${res.statusText}` }, { status: 502 })
      }
      const raw = await res.json()
      const list = Array.isArray(raw) ? raw : (raw.proxies || raw.items || raw.data || raw.results || raw.list || [])
      return upsertFromList(list, url, 'proxy-cheap')
    } catch (error: any) {
      console.error('Fetch failed:', error)
      return NextResponse.json({ error: `Fetch failed: ${error.message}` }, { status: 500 })
    }
  }

  // Fallback: sync from local file node-scripts/proxy-list.json
  try {
    const localPath = path.resolve(process.cwd(), '../../node-scripts/proxy-list.json')
    const content = await fs.readFile(localPath, 'utf-8')
    const raw = JSON.parse(content)
    const list = Array.isArray(raw) ? raw : (raw.proxies || raw.items || raw.data || raw.results || raw.list || [])
    return upsertFromList(list, localPath, 'proxy-cheap-local')
  } catch (e: any) {
    return NextResponse.json({ error: 'Missing proxy-cheap credentials and local list unavailable' }, { status: 400 })
  }
}