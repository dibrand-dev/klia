import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ObraSocialesConfig from '@/components/ajustes/ObraSocialesConfig'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const metadata = { title: 'Obras Sociales — KLIA' }

export default async function ObrasSocialesAjustesPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const { data: osList } = await supabase
    .from('profesional_obras_sociales')
    .select('*')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .order('nombre')

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/ajustes" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <h1 className="text-2xl font-bold text-on-surface">Obras Sociales</h1>
      </div>
      <p className="text-sm text-on-surface-variant mb-8 ml-9">
        Configurá las obras sociales con las que trabajás para usarlas en liquidaciones.
      </p>
      <ObraSocialesConfig initialList={osList ?? []} terapeutaId={efectivo.terapeutaId} />
    </div>
  )
}
