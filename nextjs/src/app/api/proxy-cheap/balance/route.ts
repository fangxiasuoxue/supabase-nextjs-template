import { NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const ssr = await createSSRClient();
        const { data: auth } = await ssr.auth.getUser();
        const uid = auth.user?.id;

        if (!uid) {
            return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
        }

        // Check permissions
        const { data: role } = await ssr.from('user_roles' as any).select('role').eq('user_id', uid).limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isAdmin = (role as any)?.role === 'admin';

        const { data: perm } = await ssr.from('module_permissions' as any).select('can_manage').eq('user_id', uid).eq('module', 'ip').limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canManage = isAdmin || !!(perm as any)?.can_manage;

        if (!canManage) {
            // Return empty or error? Requirement says "not display", so API should probably return 403 or empty.
            // Returning 403 is safer.
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const key = process.env.PROXY_CHEAP_API_KEY;
        const secret = process.env.PROXY_CHEAP_API_SECRET;

        if (!key || !secret) {
            return NextResponse.json({ error: 'Proxy-Cheap credentials not configured' }, { status: 500 });
        }

        const url = 'https://api.proxy-cheap.com/account/balance';
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'X-Api-Key': key,
                'X-Api-Secret': secret
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Upstream error: ${res.status} ${res.statusText} ` }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Balance fetch failed:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
