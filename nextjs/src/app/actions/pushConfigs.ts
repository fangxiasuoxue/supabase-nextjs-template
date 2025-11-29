'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export type PushConfig = {
    userId: string
    botUrl: string
    autoEnabled: boolean
}

/**
 * Get all push configurations
 */
export async function getPushConfigsAction(): Promise<{ data: PushConfig[], error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        // Get all bot URL and auto-push configs
        const { data: configs, error } = await adminClient
            .from('system_configs' as any)
            .select('key, value')
            .or('key.like.message.cheap.push.qywxboturl.%,key.like.message.cheap.push.auto.%')

        if (error) {
            return { data: [], error: error.message }
        }

        // Parse configs into PushConfig array
        const configMap = new Map<string, any>()
        if (configs) {
            (configs as any[]).forEach(c => {
                configMap.set(c.key, c.value)
            })
        }

        // Extract unique user IDs
        const userIds = new Set<string>()
        configMap.forEach((_, key) => {
            const match = key.match(/message\.cheap\.push\.(qywxboturl|auto)\.(.+)/)
            if (match) {
                userIds.add(match[2])
            }
        })

        // Build PushConfig array
        const pushConfigs: PushConfig[] = Array.from(userIds).map(userId => ({
            userId,
            botUrl: configMap.get(`message.cheap.push.qywxboturl.${userId}`) || '',
            autoEnabled: configMap.get(`message.cheap.push.auto.${userId}`) === 'true' || configMap.get(`message.cheap.push.auto.${userId}`) === true
        }))

        return { data: pushConfigs }
    } catch (e: any) {
        return { data: [], error: e.message }
    }
}

/**
 * Update or create a push configuration
 */
export async function updatePushConfigAction(userId: string, botUrl: string, autoEnabled: boolean): Promise<{ success: boolean, error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        const botUrlKey = `message.cheap.push.qywxboturl.${userId}`
        const autoKey = `message.cheap.push.auto.${userId}`

        // Update or insert bot URL
        const { data: existingBot } = await adminClient
            .from('system_configs' as any)
            .select('key')
            .eq('key', botUrlKey)
            .single()

        if (existingBot) {
            const { error } = await (adminClient
                .from('system_configs' as any) as any)
                .update({ value: botUrl, updated_at: new Date().toISOString() })
                .eq('key', botUrlKey)
            if (error) return { success: false, error: error.message }
        } else {
            const { error } = await (adminClient
                .from('system_configs' as any) as any)
                .insert({
                    key: botUrlKey,
                    value: botUrl,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            if (error) return { success: false, error: error.message }
        }

        // Update or insert auto-push setting
        const { data: existingAuto } = await adminClient
            .from('system_configs' as any)
            .select('key')
            .eq('key', autoKey)
            .single()

        if (existingAuto) {
            const { error } = await (adminClient
                .from('system_configs' as any) as any)
                .update({ value: autoEnabled.toString(), updated_at: new Date().toISOString() })
                .eq('key', autoKey)
            if (error) return { success: false, error: error.message }
        } else {
            const { error } = await (adminClient
                .from('system_configs' as any) as any)
                .insert({
                    key: autoKey,
                    value: autoEnabled.toString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            if (error) return { success: false, error: error.message }
        }

        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * Delete a push configuration
 */
export async function deletePushConfigAction(userId: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        const botUrlKey = `message.cheap.push.qywxboturl.${userId}`
        const autoKey = `message.cheap.push.auto.${userId}`

        // Delete both configs
        await adminClient
            .from('system_configs' as any)
            .delete()
            .eq('key', botUrlKey)

        await adminClient
            .from('system_configs' as any)
            .delete()
            .eq('key', autoKey)

        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
