import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { sendWeChatWorkMessage } from '@/lib/wechat'

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
        const { message_id } = await request.json()

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
        const { data: configData, error: configError } = await adminClient
            .from('system_configs' as any)
            .select('value')
            .eq('key', 'message.cheap.push.qywxboturl')
            .single()

        if (configError || !configData || !(configData as any).value) {
            return NextResponse.json({ error: 'WeChat Work Bot URL not configured' }, { status: 400 })
        }

        const webhookUrl = (configData as any).value

        // 5. Format message for Markdown
        const content = `
# 📢 New Message Notification

**Source:** <font color="info">${message.source}</font>
**Event Type:** <font color="comment">${message.event_type}</font>
**Time:** ${new Date(message.received_at).toLocaleString()}

> **Payload Summary:**
> \`\`\`json
> ${JSON.stringify(message.payload, null, 2).substring(0, 500)}${JSON.stringify(message.payload).length > 500 ? '...' : ''}
> \`\`\`

${message.notes ? `**Notes:**\n${message.notes}` : ''}
    `.trim()

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
