import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getTemplate, renderTemplate, formatDate, DEFAULT_EMAIL_TEMPLATES, TemplateVariables } from '@/lib/messageTemplate'

export async function POST(request: NextRequest) {
    try {
        // 1. Check authentication and permission
        const supabase = await createSSRClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = await createServerAdminClient()

        // Check permission (using the logic we implemented in actions/messages.ts, but here in route)
        // Or we can reuse the checkPermission logic if we export it, but it's not exported.
        // Let's just do a quick check for admin or permission here
        const { data: roleData } = await adminClient
            .from('user_roles' as any)
            .select('role')
            .eq('user_id', user.id)
            .single()

        const isAdmin = (roleData as any)?.role === 'admin'

        if (!isAdmin) {
            // Check module permission
            const { data: permData } = await adminClient
                .from('module_permissions' as any)
                .select('can_read, can_write, can_manage')
                .eq('user_id', user.id)
                .eq('module', 'messages')
                .single()

            const perms = permData as any
            // Forwarding is a "read" + "write" operation? Or just "read"?
            // Let's require 'read' permission at minimum to see the message, 
            // but maybe 'write' to perform an action? 
            // Let's stick to 'read' as it's just sending an email, but to be safe let's require 'write'
            // as it triggers an external action.
            if (!perms || !(perms.can_write || perms.can_manage)) {
                return NextResponse.json({ error: 'Forbidden: Write permission required' }, { status: 403 })
            }
        }

        // 2. Parse request body
        const { message_id, user_ids } = await request.json()

        if (!message_id || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
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

        // 4. Get target users emails
        const { data: users, error: usersError } = await adminClient
            .from('auth_users_view' as any)
            .select('id, email')

        // Get Resend configuration
        const { data: resendConfigData } = await adminClient
            .from('system_configs' as any)
            .select('key, value')
            .in('key', ['sys.resend.apikey', 'sys.resend.frommail'])

        const resendConfig = resendConfigData as any[]
        const resendApiKey = resendConfig?.find((c: any) => c.key === 'sys.resend.apikey')?.value
        const resendFromEmail = resendConfig?.find((c: any) => c.key === 'sys.resend.frommail')?.value

        // Alternative: Fetch all users and filter (not efficient but works for small scale)
        // Or better: use `adminClient.auth.admin.getUserById(id)` in a loop

        const targetEmails: string[] = []
        for (const userId of user_ids) {
            const { data: u, error: uError } = await adminClient.auth.admin.getUserById(userId)
            if (!uError && u.user && u.user.email) {
                targetEmails.push(u.user.email)
            }
        }

        if (targetEmails.length === 0) {
            return NextResponse.json({ error: 'No valid recipients found' }, { status: 400 })
        }

        // 5. Send emails
        const generateEmailContent = async (message: any) => {
            const baseStyles = `
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background-color: #ffffff;
            `;

            const footerStyles = `
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #6b7280;
            `;

            // Get subject based on event type
            const subjectMap: Record<string, string> = {
                'proxy.maintenance_window.created': '🛠️ 维护通知: IP 网络地址业务调整',
                'proxy.maintenance_window.cancelled': '✅ 维护取消: IP 网络地址业务',
                'proxy.maintenance_window.deleted': '✅ 维护取消: IP 网络地址业务',
                'proxy.status.changed': '🔄 状态变更: IP 网络地址业务',
                'proxy.bandwidth.added': '📶 流量增加: IP 网络地址业务'
            }

            const subject = subjectMap[message.event_type] || `系统通知: ${message.event_type}`

            // Get template
            const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[message.event_type as keyof typeof DEFAULT_EMAIL_TEMPLATES] || `<p>尊贵的会员,您好:</p>
<p>收到来自 {{source}} 的新通知:</p>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(message.payload, null, 2)}</pre>
<p>这是一条自动发送的系统通知。</p>
{{customContent}}`

            const template = await getTemplate('email', message.event_type, defaultTemplate)

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
                customContent: message.notes ? `<div style="margin-top: 20px; padding: 10px; background-color: #fffbeb; border-radius: 4px;"><strong>备注:</strong> ${message.notes}</div>` : ''
            }

            const bodyContent = renderTemplate(template, variables)

            const html = `
                <div style="${baseStyles}">
                    ${bodyContent}
                    <div style="${footerStyles}">
                        <p>此致,<br />IBF 平台服务团队</p>
                        <p style="margin-top: 10px; font-size: 10px; color: #9ca3af;">Event ID: ${message.event_id}</p>
                    </div>
                </div>
            `;

            return { subject, html };
        };

        const { subject, html } = await generateEmailContent(message);

        const results = []
        for (const email of targetEmails) {
            const result = await sendEmail({
                to: email,
                subject,
                html,
                apiKey: resendApiKey,
                fromEmail: resendFromEmail
            })
            results.push({ email, ...result })
        }

        // Check if at least one succeeded
        const successCount = results.filter(r => r.success).length

        if (successCount === 0) {
            return NextResponse.json({
                error: 'Failed to send emails',
                details: results
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            sent_count: successCount,
            total_count: targetEmails.length,
            results
        })

    } catch (error: any) {
        console.error('Forward error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
