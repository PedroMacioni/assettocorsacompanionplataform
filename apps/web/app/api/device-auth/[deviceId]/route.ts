import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret) {
    return NextResponse.json({ error: 'secret required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('device_auth_requests')
    .select('status, access_token, refresh_token, expires_at, device_secret')
    .eq('device_id', deviceId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Verify secret
  if (data.device_secret !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 410 })
  }

  if (data.status === 'approved' && data.access_token && data.refresh_token) {
    return NextResponse.json({
      status: 'approved',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
  }

  return NextResponse.json({ status: 'pending' })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret) {
    return NextResponse.json({ error: 'secret required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify secret before deleting
  const { data } = await admin
    .from('device_auth_requests')
    .select('device_secret')
    .eq('device_id', deviceId)
    .single()

  if (!data || data.device_secret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('device_auth_requests').delete().eq('device_id', deviceId)
  return NextResponse.json({ success: true })
}
