'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'
import { MessageFilter, ExternalMessage, MessageListResponse, BatchMessageAction } from '@/types/message'

/**
 * 检查权限
 */
async function checkPermission(requiredPermission: 'read' | 'write' | 'manage') {
    const supabase = await createSSRClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const adminClient = await createServerAdminClient()

    // 检查是否为管理员
    const { data: roleData } = await adminClient
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .single()

    if ((roleData as any)?.role === 'admin') return true

    // 检查模块权限
    // 注意: manage 权限隐含 write 和 read, write 权限隐含 read
    // 但这里我们简单检查对应的列,假设数据库中权限是独立的或者前端设置时会联动
    // 实际上通常 manage > write > read

    // 查询用户在该模块的所有权限
    const { data: permData } = await adminClient
        .from('module_permissions' as any)
        .select('can_read, can_write, can_manage')
        .eq('user_id', user.id)
        .eq('module', 'messages')
        .single()

    if (!permData) throw new Error(`Unauthorized: ${requiredPermission} permission required`)

    const perms = permData as any

    if (requiredPermission === 'read') {
        if (perms.can_read || perms.can_write || perms.can_manage) return true
    } else if (requiredPermission === 'write') {
        if (perms.can_write || perms.can_manage) return true
    } else if (requiredPermission === 'manage') {
        if (perms.can_manage) return true
    }

    throw new Error(`Unauthorized: ${requiredPermission} permission required`)
}

/**
 * 获取消息列表
 */
export async function getMessagesAction(filter?: MessageFilter) {
    try {
        await checkPermission('read')
        const adminClient = await createServerAdminClient()

        let query = adminClient
            .from('external_messages' as any)
            .select('*', { count: 'exact' })
            .is('deleted_at', null)

        // 应用筛选条件
        if (filter?.source) {
            query = query.eq('source', filter.source)
        }

        if (filter?.event_type) {
            query = query.eq('event_type', filter.event_type)
        }

        if (filter?.is_read !== undefined && filter.is_read !== 'all') {
            query = query.eq('is_read', filter.is_read)
        }

        if (filter?.start_date) {
            query = query.gte('received_at', filter.start_date)
        }

        if (filter?.end_date) {
            query = query.lte('received_at', filter.end_date)
        }

        if (filter?.search) {
            // 搜索 payload 内容或 event_type
            query = query.or(`event_type.ilike.%${filter.search}%,notes.ilike.%${filter.search}%`)
        }

        // 分页
        const page = filter?.page || 1
        const page_size = filter?.page_size || 20
        const from = (page - 1) * page_size
        const to = from + page_size - 1

        query = query
            .order('received_at', { ascending: false })
            .range(from, to)

        const { data, error, count } = await query

        if (error) throw error

        return {
            data: (data as ExternalMessage[]) || [],
            total: count || 0,
            page,
            page_size,
            error: null
        } as MessageListResponse & { error: null }
    } catch (error: any) {
        console.error('getMessagesAction error:', error)
        return {
            data: [],
            total: 0,
            page: 1,
            page_size: 20,
            error: error.message
        }
    }
}

/**
 * 更新消息
 */
export async function updateMessageAction(id: number, updates: { is_read?: boolean; notes?: string }) {
    try {
        await checkPermission('write')
        const adminClient = await createServerAdminClient()

        const { data, error } = await (adminClient
            .from('external_messages' as any) as any)
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return { data: data as ExternalMessage, error: null }
    } catch (error: any) {
        console.error('updateMessageAction error:', error)
        return { data: null, error: error.message }
    }
}

/**
 * 删除消息(软删除)
 */
export async function deleteMessageAction(id: number) {
    try {
        await checkPermission('manage')
        const adminClient = await createServerAdminClient()

        const { error } = await (adminClient
            .from('external_messages' as any) as any)
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) throw error

        return { error: null }
    } catch (error: any) {
        console.error('deleteMessageAction error:', error)
        return { error: error.message }
    }
}

/**
 * 批量操作消息
 */
export async function batchUpdateMessagesAction(action: BatchMessageAction, ids: number[]) {
    try {
        // 根据操作类型检查权限
        if (action === 'delete') {
            await checkPermission('manage')
        } else {
            await checkPermission('write')
        }

        const adminClient = await createServerAdminClient()

        let updates: any = {
            updated_at: new Date().toISOString()
        }

        switch (action) {
            case 'mark_read':
                updates.is_read = true
                break
            case 'mark_unread':
                updates.is_read = false
                break
            case 'delete':
                updates.deleted_at = new Date().toISOString()
                break
            default:
                throw new Error('Invalid action')
        }

        const { error } = await (adminClient
            .from('external_messages' as any) as any)
            .update(updates)
            .in('id', ids)

        if (error) throw error

        return { success: true, error: null }
    } catch (error: any) {
        console.error('batchUpdateMessagesAction error:', error)
        return { success: false, error: error.message }
    }
}

/**
 * 获取单个消息详情
 */
export async function getMessageAction(id: number) {
    try {
        await checkPermission('read')
        const adminClient = await createServerAdminClient()

        const { data, error } = await adminClient
            .from('external_messages' as any)
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error

        return { data: data as ExternalMessage, error: null }
    } catch (error: any) {
        console.error('getMessageAction error:', error)
        return { data: null, error: error.message }
    }
}
