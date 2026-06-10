import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Informes — KLIA' }

export default async function InformesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 py-16">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm p-10 flex flex-col items-center text-center gap-4 max-w-md w-full">
        <span className="material-symbols-outlined text-[48px] text-primary/40">description</span>
        <div>
          <p className="font-semibold text-on-surface text-base">Sección en construcción</p>
          <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
            Próximamente podrás generar y gestionar informes clínicos desde aquí.
          </p>
          <p className="text-sm text-on-surface-variant mt-3">
            Por ahora, las{' '}
            <span className="font-medium text-primary">planillas de asistencia</span>
            {' '}se generan desde la ficha del paciente → pestaña{' '}
            <span className="font-medium">Facturación</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

