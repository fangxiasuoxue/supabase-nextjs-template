import { SupabaseClient } from '@supabase/supabase-js'

type DataPermission = 'read' | 'write' | 'manage'
type Permission = 'menu' | DataPermission

/**
 * Check if user has a specific permission for a module
 * Permissions are cumulative (user can have multiple permissions)
 */
export async function hasModulePermission(
  client: SupabaseClient,
  module: string,
  perm: Permission
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  const { data } = await client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('module_permissions' as any)
    .select('can_menu, can_read, can_write, can_manage')
    .eq('user_id', uid)
    .eq('module', module)
    .limit(1)
    .maybeSingle()

  if (!data) return false

  if (perm === 'menu') return !!data.can_menu
  if (perm === 'read') return !!data.can_read
  if (perm === 'write') return !!data.can_write
  if (perm === 'manage') return !!data.can_manage

  return false
}

/**
 * Check if user has menu permission (can see menu item and access routes)
 */
export async function hasMenuPermission(
  client: SupabaseClient,
  module: string
): Promise<boolean> {
  return hasModulePermission(client, module, 'menu')
}

/**
 * Check if user is the owner of a resource
 */
export async function isResourceOwner(
  client: SupabaseClient,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  // Map resource type to table name
  const tableMap: Record<string, string> = {
    'ip_asset': 'ip_assets',
    'ip_allocation': 'ip_allocations',
  }

  const tableName = tableMap[resourceType]
  if (!tableName) return false

  const { data } = await client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(tableName as any)
    .select('owner_id')
    .eq('id', resourceId)
    .maybeSingle()

  return data?.owner_id === uid
}

/**
 * Check if a resource is assigned to the user
 */
export async function isResourceAssigned(
  client: SupabaseClient,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  const { data } = await client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('resource_assignments' as any)
    .select('id')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('user_id', uid)
    .maybeSingle()

  return !!data
}

/**
 * Check if user can access a specific resource
 * Returns true if:
 * - User has read permission (can see all resources)
 * - User is the owner of the resource
 * - Resource is assigned to the user
 */
export async function canAccessResource(
  client: SupabaseClient,
  module: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  // Check if user has read permission (can see all)
  const hasRead = await hasModulePermission(client, module, 'read')
  if (hasRead) return true

  // Check if user is owner
  const isOwner = await isResourceOwner(client, resourceType, resourceId)
  if (isOwner) return true

  // Check if resource is assigned to user
  const isAssigned = await isResourceAssigned(client, resourceType, resourceId)
  return isAssigned
}

/**
 * Check if user can modify a resource
 * Returns true if:
 * - User has write permission AND is owner
 * - User has manage permission (can modify any)
 */
export async function canModifyResource(
  client: SupabaseClient,
  module: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  // Check if user has manage permission (can modify any)
  const hasManage = await hasModulePermission(client, module, 'manage')
  if (hasManage) return true

  // Check if user has write permission AND is owner
  const hasWrite = await hasModulePermission(client, module, 'write')
  if (!hasWrite) return false

  const isOwner = await isResourceOwner(client, resourceType, resourceId)
  return isOwner
}

/**
 * Check if user can delete a resource
 * Returns true if:
 * - User has write permission AND is owner (soft delete)
 * - User has manage permission (hard delete)
 */
export async function canDeleteResource(
  client: SupabaseClient,
  module: string,
  resourceType: string,
  resourceId: string,
  hardDelete: boolean = false
): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false

  // Hard delete requires manage permission
  if (hardDelete) {
    return hasModulePermission(client, module, 'manage')
  }

  // Soft delete: write permission + ownership OR manage permission
  const hasManage = await hasModulePermission(client, module, 'manage')
  if (hasManage) return true

  const hasWrite = await hasModulePermission(client, module, 'write')
  if (!hasWrite) return false

  const isOwner = await isResourceOwner(client, resourceType, resourceId)
  return isOwner
}

/**
 * Get all permissions for a user on a module
 */
export async function getUserModulePermissions(
  client: SupabaseClient,
  module: string
): Promise<{
  menu: boolean
  read: boolean
  write: boolean
  manage: boolean
}> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id

  if (!uid) {
    return { menu: false, read: false, write: false, manage: false }
  }

  const { data } = await client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('module_permissions' as any)
    .select('can_menu, can_read, can_write, can_manage')
    .eq('user_id', uid)
    .eq('module', module)
    .limit(1)
    .maybeSingle()

  if (!data) {
    return { menu: false, read: false, write: false, manage: false }
  }

  return {
    menu: !!data.can_menu,
    read: !!data.can_read,
    write: !!data.can_write,
    manage: !!data.can_manage,
  }
}