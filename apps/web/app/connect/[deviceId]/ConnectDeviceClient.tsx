'use client'

import { useState } from 'react'
import { approveDevice } from './actions'

interface Props {
  deviceId: string
  deviceName: string
  userEmail: string
}

export function ConnectDeviceClient({ deviceId, deviceName, userEmail }: Props) {
  const [status, setStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleApprove() {
    setStatus('approving')
    const result = await approveDevice(deviceId)
    if (result.success) {
      setStatus('approved')
    } else {
      setError(result.error ?? 'Erro ao aprovar')
      setStatus('error')
    }
  }

  const containerStyle = {
    minHeight: '100vh',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Segoe UI, sans-serif',
    color: '#e0e0e0',
  } as const

  const cardStyle = {
    background: '#252525',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center' as const,
  }

  if (status === 'approved') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
          <h2 style={{ color: '#22c55e', margin: '0 0 12px' }}>Dispositivo aprovado!</h2>
          <p style={{ color: '#888', margin: 0 }}>O agent já pode sincronizar seus dados. Você pode fechar esta janela.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '40px', marginBottom: '20px' }}>&#128421;</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>
          Conectar dispositivo
        </h1>
        <p style={{ color: '#888', margin: '0 0 24px', fontSize: '14px' }}>
          Conectado como <strong style={{ color: '#e0e0e0' }}>{userEmail}</strong>
        </p>

        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#888' }}>DISPOSITIVO</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{deviceName}</p>
        </div>

        <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
          Este dispositivo quer se conectar à sua conta e sincronizar sessões do Assetto Corsa.
        </p>

        {status === 'error' && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          onClick={handleApprove}
          disabled={status === 'approving'}
          style={{
            background: status === 'approving' ? '#333' : '#e85d04',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '12px 32px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: status === 'approving' ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {status === 'approving' ? 'Aprovando...' : 'Aprovar conexão'}
        </button>
      </div>
    </div>
  )
}
