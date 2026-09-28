import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { serviceClient } from '@/lib/supabase/service'
import { obtenerDatosPlanAlimentario } from '@/lib/nutricion/plan-datos-completos'
import PlanPublicoClient from './PlanPublicoClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tu plan alimentario',
  robots: { index: false, follow: false },
}

export default async function PlanPublicoPage({ params }: { params: { token: string } }) {
  const db = serviceClient()

  const { data: share } = await db
    .from('plan_compartidos')
    .select('plan_id, terapeuta_id, vence_en, revocado_en')
    .eq('token', params.token)
    .maybeSingle()

  const vencido = !!share?.vence_en && new Date(share.vence_en) <= new Date()
  if (!share || share.revocado_en || vencido) notFound()

  const [datos, { data: plan }] = await Promise.all([
    obtenerDatosPlanAlimentario(db, share.plan_id, share.terapeuta_id),
    db.from('planes_alimentarios').select('paciente_id, updated_at').eq('id', share.plan_id).single(),
  ])

  if (!datos || !plan) notFound()

  const { data: paciente } = await db.from('pacientes').select('nombre').eq('id', plan.paciente_id).single()
  if (!paciente) notFound()

  return (
    <PlanPublicoClient
      {...datos}
      pacientePrimerNombre={paciente.nombre.split(' ')[0]}
      fechaActualizacion={plan.updated_at}
    />
  )
}
