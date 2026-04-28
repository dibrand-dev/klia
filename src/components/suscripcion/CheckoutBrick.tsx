'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    MercadoPago: new (key: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (
          type: string,
          mountId: string,
          options: Record<string, unknown>,
        ) => Promise<{ unmount: () => void }>
      }
    }
  }
}

interface Props {
  preferenceId: string
  monto: number
  plan: string
  modalidad: string
  publicKey: string
}

export default function CheckoutBrick({ preferenceId, monto, plan, modalidad, publicKey }: Props) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const brickRef = useRef<{ unmount: () => void } | null>(null)

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

      brickRef.current = await bricks.create('payment', 'checkout-brick-container', {
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
          onReady: () => { if (!cancelled) setReady(true) },
          onSubmit: async ({
            formData,
          }: {
            selectedPaymentMethod: string
            formData: Record<string, unknown>
          }) => {
            const res = await fetch('/api/suscripcion/procesar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...formData, plan, modalidad }),
            })
            const data = await res.json()
            if (!res.ok || data.error) {
              throw new Error(data.error ?? 'Error al procesar el pago')
            }
            window.location.href = '/suscripcion/resultado'
          },
          onError: (err: { message: string }) => {
            if (!cancelled) setError(err.message ?? 'Error en el formulario de pago')
          },
        },
      })
    }

    init().catch((err: Error) => {
      if (!cancelled) {
        setError(err.message ?? 'Error al cargar el checkout')
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      brickRef.current?.unmount()
    }
  }, [preferenceId, monto, plan, modalidad, publicKey])

  return (
    <div>
      {!ready && (
        <div className="flex items-center justify-center py-14">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}
      <div id="checkout-brick-container" />
    </div>
  )
}
