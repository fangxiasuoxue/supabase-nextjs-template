import { NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

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

        // Check permissions
        const { data: role } = await ssr.from('user_roles' as any).select('role').eq('user_id', uid).limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isAdmin = (role as any)?.role === 'admin';

        const { data: perm } = await ssr.from('module_permissions' as any).select('can_manage').eq('user_id', uid).eq('module', 'ip').limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canManage = isAdmin || !!(perm as any)?.can_manage;

        if (!canManage) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get the IP asset to find the provider_id
        // We need to use admin client to read if RLS blocks it (though 'manage' user should be able to read)
        // But let's use ssr client first.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: asset, error: assetError } = await ssr
            .from('ip_assets')
            .select('provider_id, provider')
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

        // Call Proxy-Cheap API
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = `https://api.proxy-cheap.com/proxies/${(asset as any).provider_id}/extend-period`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Api-Key': key,
                'X-Api-Secret': secret
            },
            body: JSON.stringify({ periodInMonths: String(period) })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Renewal failed:', errorText);
            return NextResponse.json({ error: `Upstream error: ${res.status} ${res.statusText}` }, { status: res.status });
        }

        const upstreamData = await res.json();

        // Update local database with new expiration date
        // The response contains 'expiresAt'.
        if (upstreamData.expiresAt) {
            const admin = await createServerAdminClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await (admin as any)
                .from('ip_assets')
                .update({
                    expires_at: upstreamData.expiresAt,
                    // Update other fields if needed, e.g. status
                    status: upstreamData.status?.toLowerCase() ?? undefined
                })
                .eq('id', id);

            if (updateError) {
                console.error('Failed to update local asset after renewal:', updateError);
                // We still return success because the renewal itself succeeded
            }
        }

        return NextResponse.json({ success: true, data: upstreamData });

    } catch (error: any) {
        console.error('Renewal error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
