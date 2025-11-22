'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export async function checkIsAdmin(): Promise<boolean> {
    try {
        // Use SSR client to get current user session
        const { createSSRClient } = await import('@/lib/supabase/server')
        const ssrClient = await createSSRClient()

        const { data: { user } } = await ssrClient.auth.getUser()

        if (!user) return false

        // Use admin client to check role
        const adminClient = await createServerAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await adminClient
            .from('user_roles' as any)
            .select('role')
            .eq('user_id', user.id)
            .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data as any)?.role === 'admin'
    } catch (error) {
        console.error('checkIsAdmin error:', error)
        return false
    }
}

export async function getUserPermissionsAction() {
    try {
        const { createSSRClient } = await import('@/lib/supabase/server')
        const ssrClient = await createSSRClient()
        const { data: { user } } = await ssrClient.auth.getUser()

        if (!user) return []

        const adminClient = await createServerAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await adminClient
            .from('module_permissions' as any)
            .select('module, can_menu')
            .eq('user_id', user.id)

        return data || []
    } catch (error) {
        console.error('getUserPermissionsAction error:', error)
        return []
    }
}
