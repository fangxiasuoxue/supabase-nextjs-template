'use server'

import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { createSSRClient } from '@/lib/supabase/server'

export async function ackAlertAction(alertId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authClient = await createSSRClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (!user || authError) return { success: false, error: 'Unauthorized' }

    const { data: roleData } = await authClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
      return { success: false, error: 'Forbidden' }
    }

    const adminClient = await createServerAdminClient()
    const { error } = await adminClient
      .from('alerts' as any)
      .update({ status: 'acked', acked_by: user.id, acked_at: new Date().toISOString() } as any)
      .eq('id', alertId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
