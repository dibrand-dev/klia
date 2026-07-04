import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SuscripcionPortal from '@/components/ajustes/SuscripcionPortal'

export const metadata = { title: 'Suscripción y plan — KLIA' }

export default async function SuscripcionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: suscripcion }] = await Promise.all([
    supabase
      .from('profiles')
      .select('estado_cuenta, plan, trial_fin, suscripcion_fin, codigo_descuento_id')
      .eq('id', user.id)
      .single(),
    supabase
      .from('suscripciones')
      .select('estado, plan, modalidad, suscripcion_fin, mp_preapproval_id, monto')
      .eq('terapeuta_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!profile) redirect('/login')

  let codigoDescuento: { colegioNombre: string; porcentaje: number } | null = null
  if (profile.codigo_descuento_id) {
    const { data: codigo } = await supabase
      .from('codigos_descuento')
      .select('porcentaje_descuento, colegio_id')
      .eq('id', profile.codigo_descuento_id)
      .single()
    if (codigo) {
      const { data: colegio } = await supabase
        .from('colegios')
        .select('nombre')
        .eq('id', codigo.colegio_id)
        .single()
      codigoDescuento = { colegioNombre: colegio?.nombre ?? 'Colegio profesional', porcentaje: Number(codigo.porcentaje_descuento) }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/ajustes"
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Ajustes
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-on-surface mb-2">Suscripción y plan</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Administrá tu plan, método de pago y estado de tu suscripción.
      </p>

      <SuscripcionPortal
        profile={profile}
        suscripcion={suscripcion ?? null}
        codigoDescuento={codigoDescuento}
      />
    </div>
  )
}
