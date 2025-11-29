import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { sendWeChatWorkMessage } from '@/lib/wechat'
import { getTemplate, renderTemplate, formatDate, DEFAULT_WECHAT_TEMPLATES, TemplateVariables } from '@/lib/messageTemplate'

/**
 * Auto-push message to all configured WeChat Work bots with auto-push enabled
 */
export async function autoPushMessage(messageId: number, message: any) {
    try {
        const adminClient = await createServerAdminClient()

        // Get all auto-push configurations
        const { data: configs, error } = await adminClient
            .from('system_configs' as any)
            .select('key, value')
            .like('key', 'message.cheap.push.auto.%')

        if (error || !configs) {
            console.error('Failed to get auto-push configs:', error)
            return
        }

        // Filter enabled auto-push configs
        const enabledConfigs = (configs as any[]).filter(c => c.value === 'true' || c.value === true)

        if (enabledConfigs.length === 0) {
            console.log('No auto-push configs enabled')
            return
        }

        // For each enabled config, get the corresponding bot URL and push
        for (const config of enabledConfigs) {
            // Extract user_id from key: message.cheap.push.auto.{user_id}
            const userId = config.key.replace('message.cheap.push.auto.', '')
            const botUrlKey = `message.cheap.push.qywxboturl.${userId}`

            // Get bot URL
            const { data: botConfig } = await adminClient
                .from('system_configs' as any)
                .select('value')
                .eq('key', botUrlKey)
                .single()

            if (!botConfig || !(botConfig as any).value) {
                console.warn(`Bot URL not configured for ${botUrlKey}`)
                continue
            }

            const webhookUrl = (botConfig as any).value

            // Format message using dynamic templates
            const defaultTemplate = DEFAULT_WECHAT_TEMPLATES[message.event_type as keyof typeof DEFAULT_WECHAT_TEMPLATES] || `**IBF 系统通知**
**事件类型:** {{eventType}}
**时间:** {{receivedAt}}

> **内容摘要:**
> \`\`\`json
> ${JSON.stringify(message.payload, null, 2).substring(0, 500)}${JSON.stringify(message.payload).length > 500 ? '...' : ''}
> \`\`\`

{{customContent}}`

            const template = await getTemplate('wechat', message.event_type, defaultTemplate)

            // Prepare template variables
            const variables: TemplateVariables = {
                proxyId: message.payload.proxyId,
                startsAt: message.payload.startsAt ? formatDate(message.payload.startsAt) : '',
                endsAt: message.payload.endsAt ? formatDate(message.payload.endsAt) : '',
                maintenanceWindowId: message.payload.maintenanceWindowId,
                oldStatus: message.payload.oldStatus,
                status: message.payload.status,
                trafficInGb: message.payload.trafficInGb,
                eventType: message.event_type,
                source: message.source,
                receivedAt: formatDate(message.received_at),
                notes: message.notes || '',
                customContent: message.notes ? `\n**备注:**\n${message.notes}` : ''
            }

            const content = renderTemplate(template, variables)

            // Send push
            const result = await sendWeChatWorkMessage(webhookUrl, content)

            if (result.success) {
                console.log(`Auto-pushed message ${messageId} to ${userId}`)
            } else {
                console.error(`Failed to auto-push message ${messageId} to ${userId}:`, result.error)
            }
        }
    } catch (error) {
        console.error('Auto-push error:', error)
    }
}
