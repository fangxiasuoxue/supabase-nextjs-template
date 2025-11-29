import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { sendWeChatWorkMessage } from '@/lib/wechat'
import { getTemplate, renderTemplate, formatDate, DEFAULT_WECHAT_TEMPLATES, TemplateVariables } from '@/lib/messageTemplate'

export async function POST(request: NextRequest) {
    try {
        // 1. Check authentication and permission
        const supabase = await createSSRClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = await createServerAdminClient()

        const { data: roleData } = await adminClient
            .from('user_roles' as any)
            .select('role')
            .eq('user_id', user.id)
            .single()

        const isAdmin = (roleData as any)?.role === 'admin'

        if (!isAdmin) {
            const { data: permData } = await adminClient
                .from('module_permissions' as any)
                .select('can_read, can_write, can_manage')
                .eq('user_id', user.id)
                .eq('module', 'messages')
                .single()

            const perms = permData as any
            if (!perms || !(perms.can_write || perms.can_manage)) {
                return NextResponse.json({ error: 'Forbidden: Write permission required' }, { status: 403 })
            }
        }

        // 2. Parse request body
        const { message_id, bot_key } = await request.json()

        if (!message_id) {
            return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
        }

        // 3. Get message details
        const { data: messageData, error: msgError } = await adminClient
            .from('external_messages' as any)
            .select('*')
            .eq('id', message_id)
            .single()

        if (msgError || !messageData) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 })
        }

        const message = messageData as any

        // 4. Get WeChat Work Webhook URL from config
        const configKey = bot_key || 'message.cheap.push.qywxboturl'
        const { data: configData, error: configError } = await adminClient
            .from('system_configs' as any)
            .select('value')
            .eq('key', configKey)
            .single()

        if (configError || !configData || !(configData as any).value) {
            return NextResponse.json({ error: `WeChat Work Bot URL not configured for key: ${configKey}` }, { status: 400 })
        }

        const webhookUrl = (configData as any).value

        // 5. Format message using dynamic templates
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

        // 6. Send push
        const result = await sendWeChatWorkMessage(webhookUrl, content)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Push error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
