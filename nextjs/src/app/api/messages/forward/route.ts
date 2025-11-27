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
            .from('auth_users_view' as any) // Assuming we have a view or we can query auth.users via admin API if enabled
            // Actually, we can't query auth.users directly easily unless we have a view or use listUsers
            // Let's try to query the public.users table if it exists, or use the admin client to list users
            // But listUsers is not available in Supabase client directly for bulk fetch by ID easily without loop
            // Let's assume we can query a view or table. 
            // Wait, in `api/users/list/route.ts` it uses `adminClient.auth.admin.listUsers()`.
            // Let's use that.
            .select('id, email') // This won't work on auth.users directly via postgrest

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
        const subject = `[Forward] ${message.source} - ${message.event_type}`
        const html = `
      <h2>Forwarded Message</h2>
      <p><strong>Source:</strong> ${message.source}</p>
      <p><strong>Event Type:</strong> ${message.event_type}</p>
      <p><strong>Event ID:</strong> ${message.event_id}</p>
      <p><strong>Received At:</strong> ${new Date(message.received_at).toLocaleString()}</p>
      <hr />
      <h3>Payload:</h3>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(message.payload, null, 2)}
      </pre>
      ${message.notes ? `<hr /><h3>Notes:</h3><p>${message.notes}</p>` : ''}
    `

        const results = []
        for (const email of targetEmails) {
            const result = await sendEmail({
                to: email,
                subject,
                html
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
