'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { GCPService } from '@/lib/gcp/service'
import { VPSInstance, VPSData, GCPInstance } from '@/types/vps'
import { grantResourceAccess, revokeResourceAccess } from '@/lib/auth/resourceAccess'

async function checkPermission(permission: 'read' | 'manage') {
    const { createSSRClient } = await import('@/lib/supabase/server')
    const supabase = await createSSRClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const adminClient = await createServerAdminClient()

    // Check if admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((roleData as any)?.role === 'admin') return

    // Check module permission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: permData } = await adminClient
        .from('module_permissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('module', 'vps')
        .single()

    if (!permData) throw new Error('Unauthorized: No VPS permissions')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (permission === 'manage' && !(permData as any).can_manage) {
        throw new Error('Unauthorized: Manage permission required')
    }
    // Read is implied if record exists (as per current logic, or check can_read)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (permission === 'read' && !(permData as any).can_read && !(permData as any).can_manage) {
        throw new Error('Unauthorized: Read permission required')
    }
}

async function getGCPConfigs() {
    const adminClient = await createServerAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs } = await adminClient
        .from('system_configs')
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
            .from('vps_instances')
            .select('*')
            .order('account', { ascending: true })
            .order('name', { ascending: true })

        if (error) throw error

        // #6 账单:走真实链路 name → vm_instances.vm_name → account_id → billing_snapshots(赠金)。
        //   traffic_snapshots 现无新数据(停采,列 egress_gb/ingress_gb 全空),流量仍用 vps_instances 自带列。
        const enrichAdmin = await createServerAdminClient()
        const names = (instances || []).map((i: any) => i.name).filter(Boolean)
        const creditByAccount: Record<string, number> = {}
        const acctByName: Record<string, string> = {}
        if (names.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: vms } = await enrichAdmin
                .from('vm_instances' as any).select('vm_name, account_id').in('vm_name', names)
            const accountIds = new Set<string>()
            for (const vm of ((vms as any[]) ?? [])) {
                if (vm.account_id) { acctByName[vm.vm_name] = vm.account_id; accountIds.add(vm.account_id) }
            }
            if (accountIds.size > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: snaps } = await enrichAdmin
                    .from('billing_snapshots').select('account_id, snapshot_date, credit_balance')
                    .not('credit_balance', 'is', null).in('account_id', [...accountIds])
                    .order('snapshot_date', { ascending: false })
                for (const s of ((snaps as any[]) ?? [])) {
                    if (creditByAccount[s.account_id] == null) creditByAccount[s.account_id] = Number(s.credit_balance)
                }
            }
        }

        // Map DB fields to camelCase if needed, but we updated types to match DB roughly.
        // Actually, DB columns are snake_case, types are camelCase. We need mapping.
        const mappedInstances: VPSInstance[] = (instances || []).map((i: any) => {
        const _credit = creditByAccount[acctByName[i.name]]
        return ({
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
            lastUpdated: i.last_updated,
            // #6: 赠金优先用 billing_snapshots(经账号),回退 vps_instances 列
            creditRemaining: _credit ?? i.credit_remaining ?? null,
            cost30d: i.cost_30d ?? null,
            uploadBytes: i.upload_bytes ?? null,
            downloadBytes: i.download_bytes ?? null,
            billingUpdatedAt: i.billing_updated_at ?? null,
        })})

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
        await checkPermission('manage')
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
                // 回填新模型业务键:agent 心跳/注册与 sync-from-openclaw 均按 gcp_instance_name 定位,
                // GCP 同步用实例 name 回填,使两条创建路径收敛到同一行(避免同机两行,配合 M2 唯一索引)。
                gcp_instance_name: inst.name,
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
                .from('vps_instances')
                .upsert(dbRecord as any, { onConflict: 'instance_id' })

            if (error) throw error
        }

        // 5. Cleanup stale instances
        if (instanceIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: deleteError } = await adminClient
                .from('vps_instances')
                .delete()
                .eq('account', accountAlias)
                .not('instance_id', 'in', `(${instanceIds.map(id => `"${id}"`).join(',')})`)

            if (deleteError) {
                console.error(`Error cleaning up stale instances for ${accountAlias}:`, deleteError)
            }
        } else {
            // If no instances found in GCP, delete all for this account
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: deleteError } = await adminClient
                .from('vps_instances')
                .delete()
                .eq('account', accountAlias)

            if (deleteError) {
                console.error(`Error cleaning up all instances for ${accountAlias}:`, deleteError)
            }
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
        await checkPermission('manage')
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

// Allocate VPS instance to user
export async function allocateVPSAction(vpsId: string, userId: string, notes?: string): Promise<{ success: boolean, error: string | null }> {
    try {
        await checkPermission('manage')
        const adminClient = await createServerAdminClient()

        const allocationData = {
            vps_id: vpsId,
            owner: userId,
            assigned_to: userId,
            state: 'allocated',
            allocated_at: new Date().toISOString(),
            notes: notes || ''
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await adminClient
            .from('vps_allocations')
            .insert(allocationData as any)

        if (error) throw error

        // SDD 55 · P3a —— VPS 授权统一进 access_grants:分配即镜像 write(可作部署目标 R1)。
        // 幂等,不降级已有 manage。vps_allocations 仍写(审计),两表由此保持一致。
        await grantResourceAccess(userId, 'vps', vpsId, 'write')

        return { success: true, error: null }
    } catch (error: any) {
        console.error('allocateVPSAction error:', error)
        return { success: false, error: error.message }
    }
}

// Release VPS allocation
export async function releaseVPSAction(allocationId: string): Promise<{ success: boolean, error: string | null }> {
    try {
        await checkPermission('manage')
        const adminClient: any = await createServerAdminClient()

        // 先取被回收分配的 (vps_id, owner, assigned_to),回收后据此撤销 access_grants 镜像(R3)。
        const { data: alloc } = await adminClient
            .from('vps_allocations')
            .select('vps_id, owner, assigned_to')
            .eq('id', allocationId)
            .maybeSingle()

        const { error } = await adminClient
            .from('vps_allocations')
            .update({
                state: 'released',
                released_at: new Date().toISOString()
            })
            .eq('id', allocationId)

        if (error) throw error

        // SDD 55 · P3a/R3 —— 回收即撤销 VPS 授权镜像;但仅当该用户对该 VPS 无其它 allocated 分配时才撤,
        // 避免多分配场景下误撤。撤销后其名下依赖该 VPS 的 node 变「不可重部署」(R3 反向依赖)。
        if (alloc?.vps_id) {
            const users = Array.from(new Set([alloc.owner, alloc.assigned_to].filter(Boolean))) as string[]
            for (const uid of users) {
                const { data: still } = await adminClient
                    .from('vps_allocations')
                    .select('id')
                    .eq('state', 'allocated')
                    .eq('vps_id', alloc.vps_id)
                    .or(`owner.eq.${uid},assigned_to.eq.${uid}`)
                    .limit(1)
                if (!still || still.length === 0) {
                    await revokeResourceAccess(uid, 'vps', alloc.vps_id)
                }
            }
        }

        return { success: true, error: null }
    } catch (error: any) {
        console.error('releaseVPSAction error:', error)
        return { success: false, error: error.message }
    }
}

// Get VPS allocations for a specific VPS instance
export async function getVPSAllocationsAction(vpsId: string) {
    try {
        const { createSSRClient } = await import('@/lib/supabase/server')
        const supabase = await createSSRClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabase
            .from('vps_allocations')
            .select('*')
            .eq('vps_id', vpsId)
            .eq('state', 'allocated')

        if (error) throw error
        return { allocations: data || [], error: null }
    } catch (error: any) {
        console.error('getVPSAllocationsAction error:', error)
        return { allocations: [], error: error.message }
    }
}
