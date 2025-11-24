'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

// Debug function to check VPS authorization status
export async function debugVPSAuthAction(userId: string) {
    try {
        const adminClient = await createServerAdminClient()
        const { createSSRClient } = await import('@/lib/supabase/server')
        const userClient = await createSSRClient()

        // 1. Check if vps_allocations table exists
        const { data: tables, error: tablesError } = await adminClient
            .from('information_schema.tables' as any)
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'vps_allocations')

        console.log('vps_allocations table exists:', tables)

        // 2. Check allocations for this user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allocations, error: allocError } = await adminClient
            .from('vps_allocations' as any)
            .select('*')
            .eq('owner', userId)

        console.log('Allocations for user:', allocations, allocError)

        // 3. Check what VPS instances the user can see (using their client)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: visibleInstances, error: visibleError } = await userClient
            .from('vps_instances' as any)
            .select('*')

        console.log('Visible instances for user:', visibleInstances, visibleError)

        // 4. Check RLS policies
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: policies, error: policiesError } = await adminClient
            .from('pg_policies' as any)
            .select('*')
            .eq('tablename', 'vps_instances')

        console.log('RLS policies:', policies, policiesError)

        return {
            tableExists: !!tables && tables.length > 0,
            allocations: allocations || [],
            visibleInstances: visibleInstances || [],
            policies: policies || [],
            errors: {
                tablesError,
                allocError,
                visibleError,
                policiesError
            }
        }
    } catch (error: any) {
        console.error('debugVPSAuthAction error:', error)
        return { error: error.message }
    }
}
