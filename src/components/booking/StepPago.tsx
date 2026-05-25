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
  const sym = profile.booking_moneda === 'USD' ? 'US$' : profile.booking_moneda === 'EUR' ? '€' : '$'

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
        borderRadius: 16,
        border: '1px solid #E7E9EE',
        padding: '48px 32px',
        textAlign: 'center',
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
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
            borderRadius: 10,
            padding: '13px 24px',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 6px 18px rgba(0,45,114,0.25)',
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
      <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        Completá el pago
      </p>

      {/* Summary */}
      <div style={{
        background: '#EFF4FF',
        borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '16px 18px',
        marginBottom: 14,
      }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0B1220' }}>
          {profile.nombre} {profile.apellido}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5B6472' }}>
          {TIPO_LABELS[tipo] ?? tipo}
          {' · '}
          <span style={{ textTransform: 'capitalize' }}>{fechaFmt}</span>
          {' · '}{hora} hs
        </p>
        {reserva.monto > 0 && (
          <div style={{ margin: '8px 0 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#5B6472', fontWeight: 500 }}>A pagar</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1e40af', marginLeft: 4 }}>
              {sym}{reserva.monto.toLocaleString('es-AR')}
            </span>
            <span style={{ fontSize: 12, color: '#8A93A1' }}>{profile.booking_moneda}</span>
          </div>
        )}
      </div>

      {/* Security notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#F6F7F9', borderRadius: 100, padding: '10px 14px',
        marginBottom: 14, fontSize: 12, color: '#5B6472',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Pago seguro procesado por <strong>Mercado Pago</strong></span>
      </div>

      {/* MP Brick */}
      {reserva.preference_id && reserva.mp_public_key && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #E7E9EE',
          padding: '20px',
          marginBottom: 14,
          boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
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
          background: 'transparent',
          color: '#5B6472',
          border: 'none',
          borderRadius: 10,
          padding: '11px 12px',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 4,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver y editar datos
      </button>
    </div>
  )
}
