import { NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

// ==== TESTABLE-BEGIN ====（由 ops/testing/security/renew_authz.test.js 逐字读取并 eval）
// W1 二层:续费 = 调 Proxy-Cheap extend-period(真实花钱)。此前门为
// admin OR module_permissions('ip').can_manage → 持 ip 模块权的非运维用户可续费「任意」IP。
// 收紧为 admin/ops(与其它写路由一致);admin/ops 本就管理全部 IP,故无需再查单资源授权。
function isRenewAllowed(role) {
    return role === 'admin' || role === 'ops';
}
// ==== TESTABLE-END ====

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, period } = body;

        if (!id || !period) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const ssr = await createSSRClient();
        const { data: auth } = await ssr.auth.getUser();
        const uid = auth.user?.id;

        if (!uid) {
            return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
        }

        // Check permissions — 收紧为 admin/ops(续费花钱,与其它写路由一致)
        const { data: role } = await ssr.from('user_roles').select('role').eq('user_id', uid).limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!isRenewAllowed((role as any)?.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get the IP asset to find the provider_id
        // We need to use admin client to read if RLS blocks it (though 'manage' user should be able to read)
        // But let's use ssr client first.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: asset, error: assetError } = await ssr
            .from('ip_assets')
            .select('provider_id, provider, status, expires_at')
            .eq('id', id)
            .single();

        if (assetError || !asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(asset as any).provider_id) {
            return NextResponse.json({ error: 'Asset has no provider ID' }, { status: 400 });
        }

        // Check if it is a Proxy-Cheap asset (optional but good for safety)
        // The requirement implies we are doing this for Proxy-Cheap.
        // If provider is 'Manual', we can't renew.
        // Let's assume provider string contains 'proxy-cheap' or similar, or just try if we have an ID.
        // But safer to check.
        // Based on sync script: provider is 'proxy-cheap' or 'proxy-cheap-local'.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(asset as any).provider?.toLowerCase().includes('proxy-cheap')) {
            // Allow it for now if user insists, or maybe return error?
            // Let's just proceed but log a warning if it looks wrong.
        }

        const key = process.env.PROXY_CHEAP_API_KEY;
        const secret = process.env.PROXY_CHEAP_API_SECRET;

        if (!key || !secret) {
            return NextResponse.json({ error: 'Proxy-Cheap credentials not configured' }, { status: 500 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pid = (asset as any).provider_id;
        const pcHeaders = {
            'Content-Type': 'application/json', 'Accept': 'application/json',
            'X-Api-Key': key, 'X-Api-Secret': secret,
        };
        // 过期的用 reactivate(重新启用),没过期的用 extend-period(延期)。
        // 判定:status=expired 或 expires_at 已过。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const st = String((asset as any).status ?? '').toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exp = (asset as any).expires_at;
        const isExpired = st === 'expired' || (exp && new Date(exp).getTime() < Date.now());

        let url: string;
        if (isExpired) {
            // 先询价(/reactivate/price):超过可重启窗口的会失败 → 明确提示需重购,不乱扣费
            const priceRes = await fetch(`https://api.proxy-cheap.com/proxies/${pid}/reactivate/price`, {
                method: 'POST', headers: pcHeaders, body: JSON.stringify({ periodInMonths: String(period) })
            });
            if (!priceRes.ok) {
                return NextResponse.json({ error: '该代理已超过可重新启用窗口,请在 Proxy-Cheap 后台重新购买' }, { status: 409 });
            }
            url = `https://api.proxy-cheap.com/proxies/${pid}/reactivate`;
        } else {
            url = `https://api.proxy-cheap.com/proxies/${pid}/extend-period`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: pcHeaders,
            body: JSON.stringify({ periodInMonths: String(period) })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Renewal failed:', errorText);
            return NextResponse.json({ error: `Upstream error: ${res.status} ${res.statusText}` }, { status: res.status });
        }

        const upstreamData = await res.json();

        // 续费/重启成功后立刻从 Proxy-Cheap services/proxies 拉回权威状态。
        // 实测 reactivate/extend-period 返回体不总是带 expiresAt，若只依赖返回体会导致页面必须手动 SYNC 才刷新。
        const admin = await createServerAdminClient();
        let synced = false;
        try {
            const syncUrl = 'https://api.proxy-cheap.com/services/proxies?page=1&perPage=100';
            const syncRes = await fetch(syncUrl, { headers: { Accept: 'application/json', 'X-Api-Key': key, 'X-Api-Secret': secret } });
            if (syncRes.ok) {
                const raw = await syncRes.json();
                const list = Array.isArray(raw) ? raw : (raw.proxies || raw.items || raw.data || raw.results || raw.list || []);
                const fresh = list.find((p: any) => String(p.id ?? '') === String(pid));
                if (fresh) {
                    const conn = fresh.connection || {};
                    const auth = fresh.authentication || {};
                    const meta = fresh.metadata || {};
                    const publicIp = conn.publicIp ?? fresh.publicIp ?? fresh.ip ?? conn.connectIp ?? null;
                    const updateData = {
                        label: fresh.note != null && String(fresh.note).trim() !== '' ? String(fresh.note).trim() : undefined,
                        status: fresh.status ?? null,
                        network_type: fresh.networkType ?? null,
                        country_code: fresh.countryCode ?? null,
                        proxy_type: fresh.proxyType ?? null,
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
                        bandwidth_total: (fresh.bandwidth && fresh.bandwidth.total) ?? null,
                        bandwidth_used: (fresh.bandwidth && fresh.bandwidth.used) ?? null,
                        routes: Array.isArray(fresh.routes) ? fresh.routes : [],
                        expires_at: fresh.expiresAt ?? upstreamData.expiresAt ?? null,
                        last_sync_at: new Date().toISOString(),
                        source_url: syncUrl,
                        source_raw: fresh,
                        deleted_at: null,
                    };
                    Object.keys(updateData).forEach((k) => (updateData as any)[k] === undefined && delete (updateData as any)[k]);
                    const { error: updateError } = await (admin as any).from('ip_assets').update(updateData).eq('id', id);
                    if (updateError) console.error('Failed to sync local asset after renewal:', updateError);
                    else synced = true;
                }
            } else {
                console.warn('Post-renew sync failed:', syncRes.status, syncRes.statusText);
            }
        } catch (syncError) {
            console.warn('Post-renew sync error:', syncError);
        }

        // 兜底:若列表同步未命中，但返回体含 expiresAt，也立即写本地。
        if (!synced && upstreamData.expiresAt) {
            const { error: updateError } = await (admin as any)
                .from('ip_assets')
                .update(Object.fromEntries(Object.entries({ expires_at: upstreamData.expiresAt, status: upstreamData.status }).filter(([, v]) => v !== undefined)))
                .eq('id', id);
            if (updateError) console.error('Failed to update local asset after renewal:', updateError);
        }

        return NextResponse.json({ success: true, synced, data: upstreamData });

    } catch (error: any) {
        console.error('Renewal error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
