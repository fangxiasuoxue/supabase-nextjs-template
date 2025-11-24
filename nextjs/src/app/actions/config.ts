'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { ConfigFilter, CreateConfigParams, SystemConfig, UpdateConfigParams } from '@/types/config'

async function checkAdmin() {
    // Use SSR client to get current user session on server side
    const { createSSRClient } = await import('@/lib/supabase/server')
    const supabase = await createSSRClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Use admin client to check role
    const adminClient = await createServerAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roleData } = await adminClient
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((roleData as any)?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required')
    }
}

export async function getConfigsAction(filter?: ConfigFilter) {
    try {
        await checkAdmin()
        const adminClient = await createServerAdminClient()

        let query = adminClient
            .from('system_configs' as any)
            .select('*')
            .order('created_at', { ascending: false })

        if (filter?.search) {
            query = query.or(`key.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
        }

        if (filter?.group) {
            query = query.eq('group', filter.group)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await query

        if (error) throw error

        return { data: data as SystemConfig[], error: null }
    } catch (error: any) {
        console.error('getConfigsAction error:', error)
        return { data: [], error: error.message }
    }
}

export async function upsertConfigAction(params: CreateConfigParams | UpdateConfigParams) {
    try {
        await checkAdmin()
        const adminClient = await createServerAdminClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await adminClient
            .from('system_configs' as any)
            .upsert(params as any)
            .select()
            .single()

        if (error) throw error

        return { data: data as SystemConfig, error: null }
    } catch (error: any) {
        console.error('upsertConfigAction error:', error)
        return { data: null, error: error.message }
    }
}

export async function deleteConfigAction(id: string) {
    try {
        await checkAdmin()
        const adminClient = await createServerAdminClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await adminClient
            .from('system_configs' as any)
            .delete()
            .eq('id', id)

        if (error) throw error

        return { error: null }
    } catch (error: any) {
        console.error('deleteConfigAction error:', error)
        return { error: error.message }
    }
}
