'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function BienvenidaClient({
  nombre,
  trialFin,
}: {
  nombre: string
  trialFin: string
}) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    function esperarFbq(timeoutMs = 2000, intervaloMs = 50): Promise<boolean> {
      return new Promise((resolve) => {
        const inicio = Date.now()
        const check = () => {
          if (typeof window !== 'undefined' && window.fbq) {
            resolve(true)
            return
          }
          if (Date.now() - inicio >= timeoutMs) {
            resolve(false)
            return
          }
          setTimeout(check, intervaloMs)
        }
        check()
      })
    }

    const dispararConversion = async () => {
      const fbqListo = await esperarFbq()
      if (!fbqListo) {
        // fbq nunca cargó dentro del timeout — no llamamos la RPC para no
        // consumir el guard sin poder disparar el evento; queda disponible
        // para reintentar en una futura visita.
        return
      }

      const supabase = createClient()
      const { data: esNuevo, error } = await supabase.rpc('marcar_meta_conversion_enviada')

      if (error) {
        console.error('Error marcando conversión Meta:', error)
        return // no disparamos fbq si no pudimos confirmar el guard
      }

      if (esNuevo && typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'CompleteRegistration', { content_name: 'trial_signup' })
      }
    }

    dispararConversion()
  }, [])

  useEffect(() => {
    if (seconds <= 0) {
      router.push('/dashboard')
      return
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, router])

  const fechaVencimiento = trialFin
    ? new Date(trialFin).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_8px_24px_rgba(0,26,72,0.08)] p-10 max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-on-surface">¡Tu cuenta está confirmada!</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Bienvenido/a a KLIA{nombre ? `, ${nombre}` : ''}.{' '}
            Tenés <strong className="text-on-surface">21 días de prueba gratuita</strong> con el Plan Premium completo.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2 px-6 py-3"
        >
          Ir a mi consultorio
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>

        {/* Trial date */}
        {fechaVencimiento && (
          <p className="text-xs text-on-surface-variant">
            Tu período de prueba vence el <span className="font-medium text-on-surface">{fechaVencimiento}</span>.
          </p>
        )}

        {/* Countdown */}
        <p className="text-xs text-on-surface-variant/60">
          Redirigiendo automáticamente en {seconds}s…
        </p>
      </div>
    </div>
  )
}
