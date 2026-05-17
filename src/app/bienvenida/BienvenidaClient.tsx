'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
