import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

export const metadata = { title: 'Cuenta suspendida — KLIA' }

export default async function CuentaBloqueadaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let nombre = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre')
      .eq('id', user.id)
      .single()
    nombre = profile?.nombre ?? ''
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-red-500 text-4xl">lock</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            {nombre ? `Hola ${nombre}, tu` : 'Tu'} cuenta está suspendida
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
            Tu período de prueba gratuita ha finalizado. Para seguir usando KLIA y acceder a tus pacientes, turnos e historial clínico, activá tu suscripción.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-on-surface">¿Qué incluye la suscripción?</p>
          <ul className="text-sm text-on-surface-variant space-y-2 text-left">
            {[
              'Gestión ilimitada de pacientes',
              'Agenda y turnos recurrentes',
              'Historial clínico completo',
              'Facturación e informes',
              'Soporte prioritario',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-primary text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/planes"
            className="block w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold text-center hover:bg-primary/90 transition-colors"
          >
            Ver planes y contratar
          </Link>
        </div>

        <LogoutButton />
      </div>
    </div>
  )
}
