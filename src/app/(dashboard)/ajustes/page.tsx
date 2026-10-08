import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AjustesClient from '@/components/ajustes/AjustesClient'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { puedeUsarTiposTurno } from '@/lib/modulos'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ajustes — KLIA' }

export default async function AjustesPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const [
    { data: profile },
    { data: obrasSociales },
    { data: suscripcion },
    { data: googleTokens },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', efectivo.terapeutaId).single(),
    supabase.from('profesional_obras_sociales').select('*').eq('terapeuta_id', efectivo.terapeutaId).order('nombre'),
    supabase.from('suscripciones').select('estado, plan, modalidad, suscripcion_fin, mp_preapproval_id, monto').eq('terapeuta_id', efectivo.terapeutaId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('google_calendar_tokens').select('sync_enabled').eq('terapeuta_id', efectivo.terapeutaId).maybeSingle(),
  ])

  if (!profile) redirect('/login')

  const p = profile as Record<string, unknown>

  const db = serviceClient()
  const tiposTurnoHabilitado = await puedeUsarTiposTurno(db, (p.plan as string | null) ?? '')
  const [{ data: tiposTurno }, { data: sedesActivas }] = await Promise.all([
    db
      .from('tipos_turno')
      .select('*')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('sucursales')
      .select('id, nombre, direccion, es_online, color')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activo', true)
      .order('orden', { ascending: true }),
  ])

  const tipoIds = (tiposTurno ?? []).map((t) => t.id)
  const sucursalIdsPorTipo: Record<string, string[]> = {}
  if (tipoIds.length > 0) {
    const { data: asignaciones } = await db
      .from('tipos_turno_sucursales')
      .select('tipo_turno_id, sucursal_id')
      .in('tipo_turno_id', tipoIds)
    for (const a of asignaciones ?? []) {
      (sucursalIdsPorTipo[a.tipo_turno_id] ??= []).push(a.sucursal_id)
    }
  }
  const tiposTurnoConSedes = (tiposTurno ?? []).map((t) => ({ ...t, sucursal_ids: sucursalIdsPorTipo[t.id] ?? [] }))

  return (
    <AjustesClient
      profile={profile}
      obrasSociales={obrasSociales ?? []}
      suscripcion={suscripcion ?? null}
      googleConectado={!!googleTokens}
      googleSyncEnabled={googleTokens?.sync_enabled ?? false}
      mpConectado={!!p.mp_user_id}
      mpEmail={(p.mp_email as string | null) ?? null}
      mpNombre={(p.mp_nombre as string | null) ?? null}
      cobrosVentanaHoras={(p.cobros_ventana_horas as number | null) ?? 48}
      cobrosCancelacionHoras={(p.cobros_cancelacion_horas as number | null) ?? 24}
      cobrosPrecioSesion={(p.cobros_precio_sesion as number | null) ?? null}
      cobrosMoneda={(p.cobros_moneda as string | null) ?? 'ARS'}
      cobrosMessagePaciente={(p.cobros_mensaje_paciente as string | null) ?? ''}
      esColaborador={efectivo.esColaborador}
      tiposTurnoHabilitado={tiposTurnoHabilitado}
      tiposTurno={tiposTurnoConSedes}
      sedes={sedesActivas ?? []}
    />
  )
}
