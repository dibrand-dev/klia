import { requireAdminUser } from '@/lib/ops/auth'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import WebinarsClient from '@/components/ops/WebinarsClient'
import type { Database, Webinar } from '@/types/database'

export const metadata = { title: 'Webinars — Klia Ops' }

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function WebinarsPage() {
  await requireAdminUser()

  // service_role, no el cliente de sesión: `webinars`/`inscripciones_webinar`
  // no tienen GRANT a authenticated (solo columnas públicas acotadas en
  // webinars, y nada en inscripciones_webinar — ver migración 021).
  const db = serviceClient()

  const [{ data: webinarsData }, { data: inscripciones }] = await Promise.all([
    db.from('webinars').select('*').order('fecha_inicio', { ascending: false }),
    db.from('inscripciones_webinar').select('webinar_id'),
  ])

  const conteoPorWebinar = new Map<string, number>()
  for (const i of inscripciones ?? []) {
    conteoPorWebinar.set(i.webinar_id, (conteoPorWebinar.get(i.webinar_id) ?? 0) + 1)
  }

  const webinars = ((webinarsData ?? []) as Webinar[]).map((w) => ({
    ...w,
    inscriptos_count: conteoPorWebinar.get(w.id) ?? 0,
  }))

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Webinars</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Webinars gratuitos publicados en la landing pública.
        </p>
      </div>

      <WebinarsClient webinariosIniciales={webinars} />
    </div>
  )
}
