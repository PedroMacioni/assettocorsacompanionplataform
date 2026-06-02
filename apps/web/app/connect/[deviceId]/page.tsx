import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConnectDeviceClient } from './ConnectDeviceClient'

interface Props {
  params: Promise<{ deviceId: string }>
}

export default async function ConnectDevicePage({ params }: Props) {
  const { deviceId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/connect/${deviceId}`)
  }

  const admin = createAdminClient()

  const { data: deviceRequest } = await admin
    .from('device_auth_requests')
    .select('device_id, device_name, status, expires_at')
    .eq('device_id', deviceId)
    .single()

  if (!deviceRequest) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#e0e0e0', background: '#1a1a1a', minHeight: '100vh' }}>
        <h2>Solicitação não encontrada</h2>
        <p>Este link expirou ou é inválido.</p>
      </div>
    )
  }

  if (deviceRequest.status === 'approved') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#22c55e', background: '#1a1a1a', minHeight: '100vh' }}>
        <h2>Dispositivo já aprovado</h2>
        <p>Você pode fechar esta janela.</p>
      </div>
    )
  }

  const expiresAt = new Date(deviceRequest.expires_at)
  if (expiresAt < new Date()) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', background: '#1a1a1a', minHeight: '100vh' }}>
        <h2>Solicitação expirada</h2>
        <p>Feche o agent e tente conectar novamente.</p>
      </div>
    )
  }

  return (
    <ConnectDeviceClient
      deviceId={deviceId}
      deviceName={deviceRequest.device_name}
      userEmail={user.email ?? ''}
    />
  )
}
