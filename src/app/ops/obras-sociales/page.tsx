import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import ObrasSocialesTable from '@/components/ops/ObrasSocialesTable'

export const metadata = { title: 'Obras Sociales — Klia Ops' }

export default async function ObrasSocialesPage() {
  await requireAdminUser()
  const supabase = createClient()

  const { data: pendientes } = await supabase
    .from('obras_sociales')
    .select('*')
    .eq('validada', false)
    .order('veces_ingresada', { ascending: false })

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Obras Sociales</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {pendientes?.length ?? 0} pendientes de validación
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <ObrasSocialesTable obras={pendientes ?? []} />
      </div>
    </div>
  )
}
