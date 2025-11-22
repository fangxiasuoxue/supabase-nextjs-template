import { NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function POST() {
  const key = process.env.PROXY_CHEAP_API_KEY
  const secret = process.env.PROXY_CHEAP_API_SECRET
  const admin = await createServerAdminClient()
  const now = new Date().toISOString()

  async function upsertFromList(list: any[], sourceUrl: string, providerLabel: string) {
    const rows = list.map((p: any) => {
      const conn = p.connection || {}
      const auth = p.authentication || {}
      const meta = p.metadata || {}
      const publicIp = conn.publicIp ?? p.publicIp ?? p.ip ?? null
      return {
        provider: providerLabel,
        provider_id: String(p.id ?? ''),
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
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin.from('ip_assets' as any).upsert(rows as any, { onConflict: 'provider,public_ip' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: rows.length })
  }

  if (key && secret) {
    const url = 'https://api.proxy-cheap.com/proxies'
    const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Api-Key': key, 'X-Api-Secret': secret } })
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error', status: res.status }, { status: 502 })
    }
    const raw = await res.json()
    const list = Array.isArray(raw) ? raw : (raw.proxies || raw.items || raw.data || raw.results || raw.list || [])
    return upsertFromList(list, url, 'proxy-cheap')
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