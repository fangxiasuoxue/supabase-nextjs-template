'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_WECHAT_TEMPLATES } from '@/lib/messageTemplate'

export type TemplateItem = {
    key: string
    channel: 'email' | 'wechat'
    eventType: string
    content: string
    isDefault: boolean
}

/**
 * Get all message templates from system_configs
 */
export async function getTemplatesAction(): Promise<{ data: TemplateItem[], error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        // Get all template configs
        const { data: configs, error } = await adminClient
            .from('system_configs' as any)
            .select('key, value')
            .like('key', 'message.template.%')

        if (error) {
            return { data: [], error: error.message }
        }

        // Parse configs into TemplateItem array
        const templates: TemplateItem[] = []
        const configMap = new Map<string, string>()

        if (configs) {
            (configs as any[]).forEach(c => {
                configMap.set(c.key, c.value)
            })
        }

        // Add all supported event types for both channels
        const eventTypes = [
            'proxy.maintenance_window.created',
            'proxy.maintenance_window.cancelled',
            'proxy.status.changed',
            'proxy.bandwidth.added'
        ]

        eventTypes.forEach(eventType => {
            // Email template
            const emailKey = `message.template.email.${eventType}`
            templates.push({
                key: emailKey,
                channel: 'email',
                eventType,
                content: configMap.get(emailKey) || DEFAULT_EMAIL_TEMPLATES[eventType as keyof typeof DEFAULT_EMAIL_TEMPLATES] || '',
                isDefault: !configMap.has(emailKey)
            })

            // WeChat template
            const wechatKey = `message.template.wechat.${eventType}`
            templates.push({
                key: wechatKey,
                channel: 'wechat',
                eventType,
                content: configMap.get(wechatKey) || DEFAULT_WECHAT_TEMPLATES[eventType as keyof typeof DEFAULT_WECHAT_TEMPLATES] || '',
                isDefault: !configMap.has(wechatKey)
            })
        })

        return { data: templates }
    } catch (e: any) {
        return { data: [], error: e.message }
    }
}

/**
 * Update a message template
 */
export async function updateTemplateAction(key: string, content: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        // Check if config exists
        const { data: existing } = await adminClient
            .from('system_configs' as any)
            .select('key')
            .eq('key', key)
            .single()

        if (existing) {
            // Update existing
            const { error } = await adminClient
                .from('system_configs' as any)
                .update({ value: content, updated_at: new Date().toISOString() })
                .eq('key', key)

            if (error) {
                return { success: false, error: error.message }
            }
        } else {
            // Insert new
            const { error } = await adminClient
                .from('system_configs' as any)
                .insert({
                    key,
                    value: content,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })

            if (error) {
                return { success: false, error: error.message }
            }
        }

        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * Reset a template to default
 */
export async function resetTemplateAction(key: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminClient = await createServerAdminClient()

        // Delete the config to use default
        const { error } = await adminClient
            .from('system_configs' as any)
            .delete()
            .eq('key', key)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
