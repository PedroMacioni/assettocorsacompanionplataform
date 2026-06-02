import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { device_id, device_secret, device_name } = body

    if (!device_id || !device_secret || typeof device_id !== 'string' || typeof device_secret !== 'string') {
      return NextResponse.json({ error: 'device_id and device_secret required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Clean up expired requests first
    await admin
      .from('device_auth_requests')
      .delete()
      .lt('expires_at', new Date().toISOString())

    const { error } = await admin
      .from('device_auth_requests')
      .insert({
        device_id,
        device_secret,
        device_name: device_name || 'Unknown Device',
        status: 'pending',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
