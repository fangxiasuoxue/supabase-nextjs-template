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
        let content = ''

        // Helper to format date
        const formatDate = (dateStr: string) => {
            try {
                return new Date(dateStr).toLocaleString('zh-CN', { hour12: false });
            } catch (e) {
                return dateStr;
            }
        };

        switch (message.event_type) {
            case 'proxy.maintenance_window.created':
                content = `尊贵的会员,您好:
抱歉的通知您,由于当地运营商接入线路需要调整维护,您的IP 网络地址业务将于以下时间可能不可用:
> **维护开始时间:** <font color="warning">${formatDate(message.payload.startsAt)}</font>
> **维护结束时间:** <font color="warning">${formatDate(message.payload.endsAt)}</font>
> **Proxy ID:** ${message.payload.proxyId}

在此过程中,您依赖这个 IP 地址的所有服务将中断,为了弥补因为我们的服务商给您带来的损失,我们将延长 IP 使用到期的时间,虽然它微不足道,但这仅代表IBF平台的诚意。万分抱歉, 我们将不断为您甄选最优质的的当地运营服务商,以不断提升服务的品质.感谢一路有你陪伴!`;
                break;

            case 'proxy.maintenance_window.cancelled':
            case 'proxy.maintenance_window.deleted':
                content = `尊贵的会员,您好:
您之前收到的关于 IP 网络地址业务的维护通知已取消。
> **Proxy ID:** ${message.payload.proxyId}
> **Window ID:** ${message.payload.maintenanceWindowId}

您的服务将正常运行,无需担心中断。
感谢您的理解与支持!`;
                break;

            case 'proxy.status.changed':
                content = `尊贵的会员,您好:
您的 IP 网络地址业务状态已发生变更:
> **Proxy ID:** ${message.payload.proxyId}
> **旧状态:** <font color="comment">${message.payload.oldStatus}</font>
> **新状态:** <font color="info">${message.payload.status}</font>

如有疑问,请随时联系客服。`;
                break;

            case 'proxy.bandwidth.added':
                content = `尊贵的会员,您好:
您的 IP 网络地址业务已成功增加流量:
> **Proxy ID:** ${message.payload.proxyId}
> **增加流量:** <font color="info">${message.payload.trafficInGb} GB</font>

感谢您的支持!`;
                break;

            default:
                content = `**IBF 系统通知**
**事件类型:** ${message.event_type}
**时间:** ${formatDate(message.received_at)}

> **内容摘要:**
> \`\`\`json
> ${JSON.stringify(message.payload, null, 2).substring(0, 500)}${JSON.stringify(message.payload).length > 500 ? '...' : ''}
> \`\`\`

${message.notes ? `**备注:**\n${message.notes}` : ''}`;
        }

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
