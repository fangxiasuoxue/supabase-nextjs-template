'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

/**
 * Assign a resource to a user
 */
export async function assignResourceAction(
    resourceType: string,
    resourceId: string,
    userId: string
) {
    try {
        // Check if current user has manage permission
        const ssrClient = await createSSRClient()
        const { data: { user } } = await ssrClient.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const adminClient = await createServerAdminClient()

        // Check if user has manage permission for this module
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: permission } = await adminClient
            .from('module_permissions' as any)
            .select('can_manage')
            .eq('user_id', user.id)
            .eq('module', resourceType.replace('_', ''))
            .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(permission as any)?.can_manage) {
            throw new Error('Unauthorized: Manage permission required')
        }

        // Create assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await adminClient
            .from('resource_assignments' as any)
            .insert({
                resource_type: resourceType,
                resource_id: resourceId,
                user_id: userId,
                assigned_by: user.id,
            })

        if (error) throw error
        return { error: null }
    } catch (error: any) {
        console.error('assignResourceAction error:', error)
        return { error: error.message }
    }
}

/**
 * Revoke a resource assignment
 */
export async function revokeResourceAssignmentAction(assignmentId: string) {
    try {
        // Check if current user has manage permission
        const ssrClient = await createSSRClient()
        const { data: { user } } = await ssrClient.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const adminClient = await createServerAdminClient()

        // Get assignment to check resource type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: assignment } = await adminClient
            .from('resource_assignments' as any)
            .select('resource_type')
            .eq('id', assignmentId)
            .single()

        if (!assignment) throw new Error('Assignment not found')

        // Check if user has manage permission for this module
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: permission } = await adminClient
            .from('module_permissions' as any)
            .select('can_manage')
            .eq('user_id', user.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq('module', (assignment as any).resource_type.replace('_', ''))
            .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(permission as any)?.can_manage) {
            throw new Error('Unauthorized: Manage permission required')
        }

        // Delete assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await adminClient
            .from('resource_assignments' as any)
            .delete()
            .eq('id', assignmentId)

        if (error) throw error
        return { error: null }
    } catch (error: any) {
        console.error('revokeResourceAssignmentAction error:', error)
        return { error: error.message }
    }
}

/**
 * Get resource assignments for a user
 */
export async function getUserResourceAssignmentsAction(userId: string, resourceType?: string) {
    try {
        const adminClient = await createServerAdminClient()

        let query = adminClient
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('resource_assignments' as any)
            .select('*')
            .eq('user_id', userId)

        if (resourceType) {
            query = query.eq('resource_type', resourceType)
        }

        const { data, error } = await query

        if (error) throw error
        return { data, error: null }
    } catch (error: any) {
        console.error('getUserResourceAssignmentsAction error:', error)
        return { data: null, error: error.message }
    }
}

/**
 * Get all assignments for a specific resource
 */
export async function getResourceAssignmentsAction(resourceType: string, resourceId: string) {
    try {
        const adminClient = await createServerAdminClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await adminClient
            .from('resource_assignments' as any)
            .select('*')
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)

        if (error) throw error
        return { data, error: null }
    } catch (error: any) {
        console.error('getResourceAssignmentsAction error:', error)
        return { data: null, error: error.message }
    }
}
