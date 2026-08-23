import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LiquidacionView from '@/components/facturacion/LiquidacionView'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const metadata = { title: 'Liquidación OS — KLIA' }

export default async function LiquidacionPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const [{ data: osList }, { data: profileRaw }] = await Promise.all([
    supabase.from('profesional_obras_sociales').select('*').eq('terapeuta_id', efectivo.terapeutaId).eq('activa', true).order('nombre'),
    supabase.from('profiles').select('terminologia').eq('id', efectivo.terapeutaId).single(),
  ])
  const terminologia = (profileRaw as Record<string, unknown> | null)?.terminologia as 'sesion' | 'consulta' | undefined

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Liquidación de obras sociales</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Calculá y exportá la planilla mensual por obra social.
      </p>
      <LiquidacionView osList={osList ?? []} terapeutaId={efectivo.terapeutaId} terminologia={terminologia} />
    </div>
  )
}
