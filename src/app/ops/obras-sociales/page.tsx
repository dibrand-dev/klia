import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import ObrasSocialesTable from '@/components/ops/ObrasSocialesTable'

export const metadata = { title: 'Obras Sociales — Klia Ops' }

export default async function ObrasSocialesPage() {
  await requireAdminUser()
  const supabase = createClient()

  const [{ data: activas }, { data: pendientes }] = await Promise.all([
    supabase
      .from('obras_sociales')
      .select('*')
      .eq('validada', true)
      .order('nombre'),
    supabase
      .from('obras_sociales')
      .select('*')
      .eq('validada', false)
      .order('veces_ingresada', { ascending: false }),
  ])

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px] space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Obras Sociales</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {activas?.length ?? 0} activas · {pendientes?.length ?? 0} pendientes de validación
        </p>
      </div>

      {/* Activas */}
      <section>
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Activas</h2>
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <ObrasSocialesTable obras={activas ?? []} pendientes={pendientes ?? []} />
        </div>
      </section>

      {/* Pendientes */}
      {(pendientes?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-widest mb-3">Pendientes de validación</h2>
          <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <ObrasSocialesTable obras={[]} pendientes={pendientes ?? []} showPendientes />
          </div>
        </section>
      )}
    </div>
  )
}
