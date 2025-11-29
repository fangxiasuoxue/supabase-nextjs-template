import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

/**
 * Template variable interface
 */
export interface TemplateVariables {
    proxyId?: number
    startsAt?: string
    endsAt?: string
    maintenanceWindowId?: string
    oldStatus?: string
    status?: string
    trafficInGb?: number
    eventType?: string
    source?: string
    receivedAt?: string
    notes?: string
    customContent?: string
    [key: string]: any
}

/**
 * Render template with variables
 * Supports {{variableName}} syntax
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
    let result = template

    // Replace all {{variable}} patterns
    Object.keys(variables).forEach(key => {
        const value = variables[key]
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        result = result.replace(regex, value !== null && value !== undefined ? String(value) : '')
    })

    return result
}

/**
 * Get template from system_configs
 * Falls back to default template if not found
 */
export async function getTemplate(
    channel: 'email' | 'wechat',
    eventType: string,
    defaultTemplate: string
): Promise<string> {
    try {
        const adminClient = await createServerAdminClient()
        const key = `message.template.${channel}.${eventType}`

        const { data, error } = await adminClient
            .from('system_configs' as any)
            .select('value')
            .eq('key', key)
            .single()

        if (error || !data || !(data as any).value) {
            return defaultTemplate
        }

        return (data as any).value
    } catch (error) {
        console.error('Failed to get template:', error)
        return defaultTemplate
    }
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleString('zh-CN', { hour12: false })
    } catch (e) {
        return dateStr
    }
}

/**
 * Default WeChat templates
 */
export const DEFAULT_WECHAT_TEMPLATES = {
    'proxy.maintenance_window.created': `尊贵的会员,您好:
抱歉的通知您,由于当地运营商接入线路需要调整维护,您的IP 网络地址业务将于以下时间可能不可用:
> **维护开始时间:** <font color="warning">{{startsAt}}</font>
> **维护结束时间:** <font color="warning">{{endsAt}}</font>
> **Proxy ID:** {{proxyId}}

在此过程中,您依赖这个 IP 地址的所有服务将中断,为了弥补因为我们的服务商给您带来的损失,我们将延长 IP 使用到期的时间,虽然它微不足道,但这仅代表IBF平台的诚意。万分抱歉, 我们将不断为您甄选最优质的的当地运营服务商,以不断提升服务的品质.感谢一路有你陪伴!

{{customContent}}`,

    'proxy.maintenance_window.cancelled': `尊贵的会员,您好:
您之前收到的关于 IP 网络地址业务的维护通知已取消。
> **Proxy ID:** {{proxyId}}
> **Window ID:** {{maintenanceWindowId}}

您的服务将正常运行,无需担心中断。
感谢您的理解与支持!

{{customContent}}`,

    'proxy.status.changed': `尊贵的会员,您好:
您的 IP 网络地址业务状态已发生变更:
> **Proxy ID:** {{proxyId}}
> **旧状态:** <font color="comment">{{oldStatus}}</font>
> **新状态:** <font color="info">{{status}}</font>

如有疑问,请随时联系客服。

{{customContent}}`,

    'proxy.bandwidth.added': `尊贵的会员,您好:
您的 IP 网络地址业务已成功增加流量:
> **Proxy ID:** {{proxyId}}
> **增加流量:** <font color="info">{{trafficInGb}} GB</font>

感谢您的支持!

{{customContent}}`
}

/**
 * Default Email templates (HTML)
 */
export const DEFAULT_EMAIL_TEMPLATES = {
    'proxy.maintenance_window.created': `<p>尊贵的会员,您好:</p>
<p>抱歉的通知您,由于当地运营商接入线路需要调整维护,您的IP 网络地址业务将于以下时间可能不可用:</p>
<ul style="list-style-type: none; padding: 0; margin: 20px 0;">
    <li style="margin-bottom: 10px;"><strong>维护开始时间:</strong> {{startsAt}}</li>
    <li style="margin-bottom: 10px;"><strong>维护结束时间:</strong> {{endsAt}}</li>
    <li style="margin-bottom: 10px;"><strong>Proxy ID:</strong> {{proxyId}}</li>
</ul>
<p>在此过程中,您依赖这个 IP 地址的所有服务将中断,为了弥补因为我们的服务商给您带来的损失,我们将延长 IP 使用到期的时间,虽然它微不足道,但这仅代表IBF平台的诚意。万分抱歉, 我们将不断为您甄选最优质的的当地运营服务商,以不断提升服务的品质.感谢一路有你陪伴!</p>
{{customContent}}`,

    'proxy.maintenance_window.cancelled': `<p>尊贵的会员,您好:</p>
<p>您之前收到的关于 IP 网络地址业务的维护通知已取消。</p>
<ul style="list-style-type: none; padding: 0; margin: 20px 0;">
    <li style="margin-bottom: 10px;"><strong>Proxy ID:</strong> {{proxyId}}</li>
    <li style="margin-bottom: 10px;"><strong>Window ID:</strong> {{maintenanceWindowId}}</li>
</ul>
<p>您的服务将正常运行,无需担心中断。</p>
<p>感谢您的理解与支持!</p>
{{customContent}}`,

    'proxy.status.changed': `<p>尊贵的会员,您好:</p>
<p>您的 IP 网络地址业务状态已发生变更:</p>
<ul style="list-style-type: none; padding: 0; margin: 20px 0;">
    <li style="margin-bottom: 10px;"><strong>Proxy ID:</strong> {{proxyId}}</li>
    <li style="margin-bottom: 10px;"><strong>旧状态:</strong> {{oldStatus}}</li>
    <li style="margin-bottom: 10px;"><strong>新状态:</strong> <strong>{{status}}</strong></li>
</ul>
<p>如有疑问,请随时联系客服。</p>
{{customContent}}`,

    'proxy.bandwidth.added': `<p>尊贵的会员,您好:</p>
<p>您的 IP 网络地址业务已成功增加流量:</p>
<ul style="list-style-type: none; padding: 0; margin: 20px 0;">
    <li style="margin-bottom: 10px;"><strong>Proxy ID:</strong> {{proxyId}}</li>
    <li style="margin-bottom: 10px;"><strong>增加流量:</strong> <strong>{{trafficInGb}} GB</strong></li>
</ul>
<p>感谢您的支持!</p>
{{customContent}}`
}
