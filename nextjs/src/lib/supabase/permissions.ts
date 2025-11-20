import { SupabaseClient } from '@supabase/supabase-js'

type Perm = 'read' | 'write' | 'manage'

export async function hasModulePermission(client: SupabaseClient, module: string, perm: Perm): Promise<boolean> {
  const { data: userRes } = await client.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return false
  const { data } = await client
    .from('module_permissions' as any)
    .select('can_read, can_write, can_manage')
    .eq('user_id', uid)
    .eq('module', module)
    .limit(1)
    .maybeSingle()
  if (!data) return false
  if (perm === 'read') return !!data.can_read
  if (perm === 'write') return !!data.can_write
  if (perm === 'manage') return !!data.can_manage
  return false
}