import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

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
        const generateEmailContent = (message: any) => {
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

            const ulStyles = `
                list-style-type: none;
                padding: 0;
                margin: 20px 0;
            `;

            const liStyles = `
                margin-bottom: 10px;
                padding-left: 0;
            `;

            const footerStyles = `
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #6b7280;
            `;

            let subject = '';
            let bodyContent = '';

            // Helper to format date
            const formatDate = (dateStr: string) => {
                try {
                    return new Date(dateStr).toLocaleString();
                } catch (e) {
                    return dateStr;
                }
            };

            switch (message.event_type) {
                case 'proxy.maintenance_window.created':
                    subject = 'Proxy Maintenance Window Created';
                    bodyContent = `
                        <p>Dear User,</p>
                        <p>A new maintenance window has been scheduled for one of your proxies.</p>
                        <ul style="${ulStyles}">
                            <li style="${liStyles}"><strong>Proxy ID:</strong> ${message.payload.proxyId}</li>
                            <li style="${liStyles}"><strong>Window ID:</strong> ${message.payload.maintenanceWindowId}</li>
                            <li style="${liStyles}"><strong>Start Time:</strong> ${formatDate(message.payload.startsAt)}</li>
                            <li style="${liStyles}"><strong>End Time:</strong> ${formatDate(message.payload.endsAt)}</li>
                        </ul>
                        <p>This notification was generated because your account is subscribed to maintenance-related webhook events.</p>
                    `;
                    break;

                case 'proxy.maintenance_window.cancelled':
                case 'proxy.maintenance_window.deleted':
                    subject = 'Proxy Maintenance Window Cancelled';
                    bodyContent = `
                        <p>Dear User,</p>
                        <p>The scheduled maintenance window has been cancelled.</p>
                        <ul style="${ulStyles}">
                            <li style="${liStyles}"><strong>Proxy ID:</strong> ${message.payload.proxyId}</li>
                            <li style="${liStyles}"><strong>Window ID:</strong> ${message.payload.maintenanceWindowId}</li>
                            ${message.payload.startsAt ? `<li style="${liStyles}"><strong>Original Start:</strong> ${formatDate(message.payload.startsAt)}</li>` : ''}
                            ${message.payload.endsAt ? `<li style="${liStyles}"><strong>Original End:</strong> ${formatDate(message.payload.endsAt)}</li>` : ''}
                        </ul>
                        <p>This notification was automatically generated.</p>
                    `;
                    break;

                case 'proxy.status.changed':
                    subject = 'Proxy Status Update';
                    bodyContent = `
                        <p>Dear User,</p>
                        <p>The status of one of your proxies has changed.</p>
                        <ul style="${ulStyles}">
                            <li style="${liStyles}"><strong>Proxy ID:</strong> ${message.payload.proxyId}</li>
                            <li style="${liStyles}"><strong>Old Status:</strong> ${message.payload.oldStatus}</li>
                            <li style="${liStyles}"><strong>New Status:</strong> <strong>${message.payload.status}</strong></li>
                        </ul>
                        <p>This message was sent because you have monitoring enabled.</p>
                    `;
                    break;

                case 'proxy.bandwidth.added':
                    subject = 'Proxy Bandwidth Added';
                    bodyContent = `
                        <p>Dear User,</p>
                        <p>Additional bandwidth has been successfully added to your proxy.</p>
                        <ul style="${ulStyles}">
                            <li style="${liStyles}"><strong>Proxy ID:</strong> ${message.payload.proxyId}</li>
                            <li style="${liStyles}"><strong>Added Traffic:</strong> <strong>${message.payload.trafficInGb} GB</strong></li>
                        </ul>
                        <p>This notification confirms the resource allocation.</p>
                    `;
                    break;

                default:
                    subject = `System Notification: ${message.event_type}`;
                    bodyContent = `
                        <p>Dear User,</p>
                        <p>A new event has been received from ${message.source}:</p>
                        <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(message.payload, null, 2)}</pre>
                        <p>This is an automated system notification.</p>
                    `;
            }

            const html = `
                <div style="${baseStyles}">
                    ${bodyContent}
                    ${message.notes ? `
                        <div style="margin-top: 20px; padding: 10px; background-color: #fffbeb; border-radius: 4px;">
                            <strong>Note:</strong> ${message.notes}
                        </div>
                    ` : ''}
                    <div style="${footerStyles}">
                        <p>Kind regards,<br />System Notification Service</p>
                        <p style="margin-top: 10px; font-size: 10px; color: #9ca3af;">Event ID: ${message.event_id}</p>
                    </div>
                </div>
            `;

            return { subject, html };
        };

        const { subject, html } = generateEmailContent(message);

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
