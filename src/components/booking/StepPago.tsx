'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProfileData } from '@/app/p/[slug]/page'
import type { ConfirmacionData } from './BookingClient'

declare global {
  interface Window {
    MercadoPago: new (key: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (
          type: string,
          mountId: string,
          options: Record<string, unknown>
        ) => Promise<{ unmount: () => void }>
      }
    }
  }
}

interface DatosForm {
  nombre: string
  apellido: string
  email: string
  telefono: string
}

interface Props {
  profile: ProfileData
  tipo: string
  fecha: string
  hora: string
  modalidad: string
  datosForm: DatosForm
  onConfirmacion: (conf: ConfirmacionData) => void
  onBack: () => void
  onErrPago: () => void
  onErrSlot: () => void
}

interface CrearResponse {
  hash: string
  preference_id: string | null
  monto: number
  mp_public_key: string | null
  confirmado?: boolean
  turno_id?: string
  error?: string
}

const TIPO_LABELS: Record<string, string> = {
  sesion: 'Sesión',
  entrevista: 'Entrevista inicial',
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Videollamada',
  telefonica: 'Telefónica',
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// ─── BookingCheckoutBrick ─────────────────────────────────────────────────────

interface BrickProps {
  preferenceId: string
  monto: number
  publicKey: string
  hash: string
  onSuccess: (data: ConfirmacionData) => void
  onError: () => void
}

function BookingCheckoutBrick({
  preferenceId,
  monto,
  publicKey,
  hash,
  onSuccess,
  onError,
}: BrickProps) {
  const [ready, setReady] = useState(false)
  const [brickError, setBrickError] = useState<string | null>(null)
  const brickRef = useRef<{ unmount: () => void } | null>(null)
  const mountId = 'booking-brick-container'

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!window.MercadoPago) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://sdk.mercadopago.com/js/v2'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('No se pudo cargar el SDK de Mercado Pago'))
          document.head.appendChild(script)
        })
      }

      if (cancelled) return

      const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' })
      const bricks = mp.bricks()

      brickRef.current = await bricks.create('payment', mountId, {
        initialization: {
          amount: monto,
          preferenceId,
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            mercadoPago: ['wallet_purchase'],
          },
          visual: {
            style: { customVariables: { borderRadius: '12px' } },
          },
        },
        callbacks: {
          onReady: () => {
            if (!cancelled) setReady(true)
          },
          onSubmit: async ({
            formData,
          }: {
            selectedPaymentMethod: string
            formData: Record<string, unknown>
          }) => {
            const res = await fetch('/api/booking/confirmar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hash, formData: { ...formData } }),
            })
            const data = await res.json()
            if (!res.ok || data.error) {
              throw new Error('pago_rechazado')
            }
            if (!cancelled) {
              onSuccess(data as ConfirmacionData)
            }
          },
          onError: (err: { message: string }) => {
            if (!cancelled) {
              setBrickError(err.message ?? 'Error en el formulario de pago')
              onError()
            }
          },
        },
      })
    }

    init().catch((err: Error) => {
      if (!cancelled) {
        setBrickError(err.message ?? 'Error al cargar el checkout')
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      brickRef.current?.unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferenceId, monto, publicKey, hash])

  return (
    <div>
      {!ready && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 0',
        }}>
          <div className="bk-spinner" />
        </div>
      )}
      {brickError && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          fontSize: 13,
          padding: '12px 16px',
          borderRadius: 10,
          marginBottom: 12,
        }}>
          {brickError}
        </div>
      )}
      <div id={mountId} />
    </div>
  )
}

// ─── StepPago ────────────────────────────────────────────────────────────────

export default function StepPago({
  profile,
  tipo,
  fecha,
  hora,
  modalidad,
  datosForm,
  onConfirmacion,
  onBack,
  onErrPago,
  onErrSlot,
}: Props) {
  const [creating, setCreating] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)
  const [reserva, setReserva] = useState<CrearResponse | null>(null)

  const duracion = tipo === 'sesion'
    ? profile.booking_duracion_sesion
    : profile.booking_duracion_entrevista

  const fechaFmt = formatFecha(fecha)

  useEffect(() => {
    let cancelled = false

    async function crearReserva() {
      try {
        const res = await fetch('/api/booking/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: profile.booking_slug,
            fecha,
            hora,
            tipo,
            modalidad,
            nombre: datosForm.nombre,
            apellido: datosForm.apellido,
            email: datosForm.email,
            telefono: datosForm.telefono || undefined,
          }),
        })

        const data = await res.json()

        if (cancelled) return

        if (res.status === 409 || data.error === 'slot_taken') {
          onErrSlot()
          return
        }

        if (!res.ok || data.error) {
          setCreateError(data.error ?? 'No se pudo crear la reserva. Intentá nuevamente.')
          setCreating(false)
          return
        }

        // Free booking confirmed immediately
        if (data.confirmado) {
          onConfirmacion({
            turno_id: data.turno_id ?? '',
            mp_payment_id: null,
            fecha_fmt: fechaFmt,
            hora,
            duracion,
            monto: 0,
            moneda: profile.booking_moneda,
            referencia: data.hash ?? '',
          })
          return
        }

        setReserva(data)
        setCreating(false)
      } catch {
        if (!cancelled) {
          setCreateError('Error de conexión. Por favor intentá nuevamente.')
          setCreating(false)
        }
      }
    }

    crearReserva()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (creating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        gap: 16,
      }}>
        <div className="bk-spinner" />
        <p style={{ margin: 0, fontSize: 14, color: '#5B6472' }}>Preparando tu reserva…</p>
      </div>
    )
  }

  if (createError) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E7E9EE',
        padding: '48px 32px',
        textAlign: 'center',
        boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 28,
          background: '#FEE2E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 24,
        }}>⚠️</div>
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#0B1220' }}>
          Algo salió mal
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#5B6472', lineHeight: 1.6 }}>
          {createError}
        </p>
        <button
          onClick={onBack}
          style={{
            background: '#001a48',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Volver atrás
        </button>
      </div>
    )
  }

  if (!reserva) return null

  return (
    <div>
      {/* Summary */}
      <div style={{
        background: '#EFF4FF',
        borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '16px 18px',
        marginBottom: 16,
      }}>
        <p style={{
          margin: '0 0 10px',
          fontSize: 11,
          fontWeight: 700,
          color: '#1e40af',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Tu reserva
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SRow icon="🗂" label={TIPO_LABELS[tipo] ?? tipo} />
          <SRow icon="👤" label={`${profile.nombre} ${profile.apellido}`} />
          <SRow icon="📅" label={<span style={{ textTransform: 'capitalize' }}>{fechaFmt}</span>} />
          <SRow icon="🕐" label={`${hora} hs · ${duracion} min`} />
          <SRow icon="📍" label={MODALIDAD_LABELS[modalidad] ?? modalidad} />
          {reserva.monto > 0 && (
            <SRow icon="💰" label={
              <strong style={{ color: '#1e40af' }}>
                ${reserva.monto.toLocaleString('es-AR')} {profile.booking_moneda}
              </strong>
            } />
          )}
        </div>
      </div>

      {/* MP Brick */}
      {reserva.preference_id && reserva.mp_public_key && (
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #E7E9EE',
          padding: '20px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
        }}>
          <p style={{
            margin: '0 0 16px',
            fontSize: 11,
            fontWeight: 700,
            color: '#8A93A1',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Datos de pago
          </p>
          <BookingCheckoutBrick
            preferenceId={reserva.preference_id}
            monto={reserva.monto}
            publicKey={reserva.mp_public_key}
            hash={reserva.hash}
            onSuccess={onConfirmacion}
            onError={onErrPago}
          />
        </div>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          width: '100%',
          background: '#F6F7F9',
          color: '#374151',
          border: '1px solid #E7E9EE',
          borderRadius: 14,
          padding: '13px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
          marginTop: 4,
        }}
      >
        ← Volver y editar datos
      </button>
    </div>
  )
}

function SRow({ icon, label }: { icon: string; label: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.4 }}>{label}</span>
    </div>
  )
}
