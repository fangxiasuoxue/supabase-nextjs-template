'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { GCPService } from '@/lib/gcp/service'
import { VPSInstance, VPSData, GCPInstance } from '@/types/vps'

async function checkAdmin() {
    const { createSSRClient } = await import('@/lib/supabase/server')
    const supabase = await createSSRClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

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

async function getGCPConfigs() {
    const adminClient = await createServerAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs } = await adminClient
        .from('system_configs' as any)
        .select('*')
        .like('key', 'vps.gcp.key.%')

    return configs || []
}

// Fetch data from DB
export async function getVPSInstancesAction(): Promise<{ data: VPSData | null, error: string | null }> {
    try {
        const { createSSRClient } = await import('@/lib/supabase/server')
        const supabase = await createSSRClient()

        // Use SSR client which has user context, RLS will handle permission check
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instances, error } = await supabase
            .from('vps_instances' as any)
            .select('*')
            .order('account', { ascending: true })
            .order('name', { ascending: true })

        if (error) throw error

        // Map DB fields to camelCase if needed, but we updated types to match DB roughly.
        // Actually, DB columns are snake_case, types are camelCase. We need mapping.
        const mappedInstances: VPSInstance[] = (instances || []).map((i: any) => ({
            id: i.id,
            instanceId: i.instance_id,
            name: i.name,
            zone: i.zone,
            status: i.status,
            machineType: i.machine_type,
            internalIp: i.internal_ip,
            externalIp: i.external_ip,
            account: i.account,
            trafficReceived: i.traffic_received,
            trafficSent: i.traffic_sent,
            billingUsed: i.billing_used,
            billingRemaining: i.billing_remaining,
            lastUpdated: i.last_updated
        }))

        return {
            data: {
                instances: mappedInstances,
                lastUpdated: Date.now()
            },
            error: null
        }
    } catch (error: any) {
        console.error('getVPSInstancesAction error:', error)
        return { data: null, error: error.message }
    }
}

// Sync single account
export async function syncAccountVPSAction(accountAlias: string): Promise<{ success: boolean, error: string | null }> {
    try {
        await checkAdmin()
        const configs = await getGCPConfigs()
        const config = configs.find((c: any) => c.key === `vps.gcp.key.${accountAlias}`)

        if (!config) throw new Error(`Configuration for account ${accountAlias} not found`)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const credentials = JSON.parse((config as any).value)
        if (!credentials.project_id) throw new Error(`Missing project_id for ${accountAlias}`)

        const service = new GCPService(credentials)
        const adminClient = await createServerAdminClient()

        // 1. Fetch Instances
        const instances: GCPInstance[] = await service.listInstances(accountAlias)
        const instanceIds = instances.map(i => i.id)

        // 2. Fetch Traffic
        let trafficMap: any = {}
        if (instanceIds.length > 0) {
            trafficMap = await service.getTraffic(instanceIds)
        }

        // 3. Fetch Billing
        const billing = await service.getBilling(accountAlias)

        // 4. Upsert to DB
        for (const inst of instances) {
            const traffic = trafficMap[inst.id]
            const billingData = billing // Billing is per account, applies to all instances of that account? 
            // User said: "billing... if multiple vps, show same". So yes.

            const dbRecord = {
                instance_id: inst.id,
                account: accountAlias,
                name: inst.name,
                zone: inst.zone,
                status: inst.status,
                machine_type: inst.machineType,
                internal_ip: inst.internalIp,
                external_ip: inst.externalIp,
                traffic_received: traffic ? traffic.receivedGB : 0,
                traffic_sent: traffic ? traffic.sentGB : 0,
                billing_used: billingData ? billingData.totalUsed : 0,
                billing_remaining: billingData ? billingData.remaining : 0,
                last_updated: new Date().toISOString()
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await adminClient
                .from('vps_instances' as any)
                .upsert(dbRecord as any, { onConflict: 'instance_id' })

            if (error) throw error
        }

        return { success: true, error: null }
    } catch (error: any) {
        console.error(`syncAccountVPSAction error for ${accountAlias}:`, error)
        return { success: false, error: error.message }
    }
}

// Sync all accounts
export async function syncAllVPSAction(): Promise<{ results: { account: string, success: boolean, error?: string }[] }> {
    try {
        await checkAdmin()
        const configs = await getGCPConfigs()
        const results = []

        for (const config of configs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const accountAlias = (config as any).key.replace('vps.gcp.key.', '')
            const result = await syncAccountVPSAction(accountAlias)
            results.push({
                account: accountAlias,
                success: result.success,
                error: result.error || undefined
            })
        }

        return { results }
    } catch (error: any) {
        console.error('syncAllVPSAction error:', error)
        return { results: [] } // Should probably return global error
    }
}
