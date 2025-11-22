'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export type UserWithDetails = {
  id: string
  email: string
  created_at: string
  role: 'admin' | 'operator' | 'user'
  permissions: {
    [module: string]: {
      can_menu: boolean
      can_read: boolean
      can_write: boolean
      can_manage: boolean
    }
  }
}

async function checkAdmin() {
  // Use SSR client to get current user session on server side
  const { createSSRClient } = await import('@/lib/supabase/server')
  const supabase = await createSSRClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Use admin client to check role
  const adminClient = await createServerAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roleData } = await adminClient
    .from('user_roles' as any)
    .select('role')
    .eq('user_id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((roleData as any)?.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required')
  }
}

export async function getUsersAction(page: number = 1, limit: number = 10, search?: string) {
  try {
    await checkAdmin()
    const adminClient = await createServerAdminClient()

    // 1. List users from auth.users
    // Note: supabase-js admin client listUsers doesn't support complex filtering/search easily on server-side without direct DB access or specific APIs
    // We will fetch a page of users. Search might be limited to what the API supports or we filter in memory if list is small, 
    // but for a scalable solution we might need a different approach. 
    // For now, we'll use listUsers and basic pagination.

    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({
      page: page,
      perPage: limit,
    })

    if (usersError) throw usersError

    // Filter by email if search is provided (client-side filtering for now as listUsers search is limited)
    let filteredUsers = users
    if (search) {
      filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()))
    }

    const userIds = filteredUsers.map(u => u.id)

    // 2. Fetch roles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles } = await adminClient
      .from('user_roles' as any)
      .select('*')
      .in('user_id', userIds)

    // 3. Fetch permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: permissions } = await adminClient
      .from('module_permissions' as any)
      .select('*')
      .in('user_id', userIds)

    // 4. Merge data
    const result: UserWithDetails[] = filteredUsers.map(u => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userRole = (roles as any)?.find((r: any) => r.user_id === u.id)?.role || 'user'

      const userPerms: UserWithDetails['permissions'] = {}
      // Initialize default modules
      const modules = ['vps', 'nodes', 'ip', 'orders']
      modules.forEach(m => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (permissions as any)?.find((perm: any) => perm.user_id === u.id && perm.module === m)
        userPerms[m] = {
          can_menu: p?.can_menu || false,
          can_read: p?.can_read || false,
          can_write: p?.can_write || false,
          can_manage: p?.can_manage || false
        }
      })

      return {
        id: u.id,
        email: u.email || '',
        created_at: u.created_at,
        role: userRole as 'admin' | 'operator' | 'user',
        permissions: userPerms
      }
    })

    // Total count is not returned by listUsers easily without a separate call or knowing total. 
    // We'll return the count of fetched users for now or try to get total if possible.
    // listUsers returns 'total' in some versions/configs but let's assume we just paginate.

    return { data: result, count: 0, error: null } // Count 0 for now as listUsers pagination is tricky for total count without separate query

  } catch (error: any) {
    console.error('getUsersAction error:', error)
    return { data: [], count: 0, error: error.message }
  }
}

export async function updateUserRoleAction(userId: string, role: string) {
  try {
    await checkAdmin()
    const adminClient = await createServerAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await adminClient
      .from('user_roles' as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ user_id: userId, role: role } as any)

    if (error) throw error
    return { error: null }
  } catch (error: any) {
    console.error('updateUserRoleAction error:', error)
    return { error: error.message }
  }
}

export async function updateModulePermissionAction(userId: string, module: string, permission: 'menu' | 'read' | 'write' | 'manage', value: boolean) {
  try {
    await checkAdmin()
    const adminClient = await createServerAdminClient()

    // First get existing permission row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await adminClient
      .from('module_permissions' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('module', module)
      .maybeSingle()

    // Prepare update data with all fields
    const updateData: any = {
      user_id: userId,
      module: module,
      can_menu: false,
      can_read: false,
      can_write: false,
      can_manage: false,
    }

    // If existing record, preserve current values
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateData.can_menu = (existing as any).can_menu || false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateData.can_read = (existing as any).can_read || false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateData.can_write = (existing as any).can_write || false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateData.can_manage = (existing as any).can_manage || false
    }

    // Update the specific permission
    if (permission === 'menu') updateData.can_menu = value
    if (permission === 'read') updateData.can_read = value
    if (permission === 'write') updateData.can_write = value
    if (permission === 'manage') updateData.can_manage = value

    // If all permissions are false, delete the record instead of upserting
    if (!updateData.can_menu && !updateData.can_read && !updateData.can_write && !updateData.can_manage) {
      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await adminClient
          .from('module_permissions' as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .delete()
          .eq('id', (existing as any).id)

        if (error) throw error
      }
      // If no existing record and all permissions are false, nothing to do
      return { error: null }
    }

    // Upsert the permission record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await adminClient
      .from('module_permissions' as any)
      .upsert(updateData, { onConflict: 'user_id, module' })

    if (error) throw error
    return { error: null }
  } catch (error: any) {
    console.error('updateModulePermissionAction error:', error)
    return { error: error.message }
  }
}

