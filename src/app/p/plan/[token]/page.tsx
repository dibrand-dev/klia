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

  const [datos, { data: plan }, { data: redes }] = await Promise.all([
    obtenerDatosPlanAlimentario(db, share.plan_id, share.terapeuta_id),
    db.from('planes_alimentarios').select('paciente_id, updated_at').eq('id', share.plan_id).single(),
    // Redes sociales del profesional — no forman parte de DatosPlanAlimentario
    // (ese tipo vive en plan-alimentario.ts, el generador de PDF, congelado y
    // sin usar desde la UI) así que se resuelven acá aparte, solo para el
    // link público.
    db.from('profiles').select('instagram_url, facebook_url, x_url, tiktok_url, linkedin_url').eq('id', share.terapeuta_id).maybeSingle(),
  ])

  if (!datos || !plan) notFound()

  const { data: paciente } = await db.from('pacientes').select('nombre').eq('id', plan.paciente_id).single()
  if (!paciente) notFound()

  return (
    <PlanPublicoClient
      {...datos}
      pacientePrimerNombre={paciente.nombre.split(' ')[0]}
      fechaActualizacion={plan.updated_at}
      redes={{
        instagram_url: redes?.instagram_url ?? null,
        facebook_url: redes?.facebook_url ?? null,
        x_url: redes?.x_url ?? null,
        tiktok_url: redes?.tiktok_url ?? null,
        linkedin_url: redes?.linkedin_url ?? null,
      }}
    />
  )
}
