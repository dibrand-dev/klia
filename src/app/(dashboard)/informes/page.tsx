import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Informes — KLIA' }

export default async function InformesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[900px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Informes</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Informes clínicos, planillas de asistencia y documentación.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm p-10 flex flex-col items-center text-center gap-4">
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
