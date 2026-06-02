'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function approveDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: 'Not authenticated' }
    }

    const admin = createAdminClient()

    // Verify the request exists and is pending
    const { data: request } = await admin
      .from('device_auth_requests')
      .select('device_id, status, expires_at')
      .eq('device_id', deviceId)
      .single()

    if (!request) {
      return { success: false, error: 'Request not found' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Request already processed' }
    }

    if (new Date(request.expires_at) < new Date()) {
      return { success: false, error: 'Request expired' }
    }

    // Write user's tokens to the device request
    const { error: updateError } = await admin
      .from('device_auth_requests')
      .update({
        user_id: session.user.id,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        status: 'approved',
      })
      .eq('device_id', deviceId)
      .eq('status', 'pending')

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Internal error' }
  }
}
