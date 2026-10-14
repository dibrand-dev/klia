import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { validarTipoSede } from '@/lib/booking/resolver-tipo'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Validación server-side de tipo_turno_id↔sucursal_id al crear turnos desde
// la Agenda interna (single y serie) — mismo criterio de negocio que
// resolver-tipo.ts (reserva pública), vía validarTipoSede. A diferencia del
// booking público, acá no se exige visible_en_booking=true: un tipo
// "solo en agenda" es igual de válido.
//
// tipos_turno y tipos_turno_sucursales tienen RLS habilitado sin policies —
// con el cliente de usuario, authenticated no tiene bypassrls y toda query
// devuelve 0 filas sin importar los datos reales (confirmado contra la base:
// GRANTs correctos, pg_policies vacío para ambas tablas). Por eso esta ruta
// usa serviceClient() para esas dos tablas; la autorización sigue corriendo
// por getEffectiveTerapeutaIdServer (cliente de usuario) y por el filtro
// explícito `.eq('terapeuta_id', ...)` en cada query — nunca por RLS.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tipo_turno_id: tipoTurnoId, sucursal_id: sucursalId } = await req.json() as {
    tipo_turno_id?: string | null
    sucursal_id?: string | null
  }

  // Tipos base (sin tipo_turno_id) nunca se filtran por sede.
  if (!tipoTurnoId) return NextResponse.json({ ok: true })

  const db = serviceClient()

  const { data: tipoTurno } = await db
    .from('tipos_turno')
    .select('id')
    .eq('id', tipoTurnoId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .eq('activo', true)
    .maybeSingle()

  if (!tipoTurno) return NextResponse.json({ ok: false, error: 'tipo_invalido' }, { status: 400 })

  const ok = await validarTipoSede(db, efectivo.terapeutaId, tipoTurnoId, sucursalId ?? null)
  if (!ok) return NextResponse.json({ ok: false, error: 'tipo_invalido' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
