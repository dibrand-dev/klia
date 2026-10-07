import type { SupabaseClient } from '@supabase/supabase-js'

// Resuelve duración/precio/moneda/nombre para una reserva pública — nunca
// confía en valores que pudiera mandar el cliente, salvo el id del tipo
// propio elegido (que se valida siempre contra la base).
export type TipoResuelto = {
  duracion: number
  precio: number | null
  moneda: string
  tipoTurnoId: string | null
  nombre: string
}

export type ProfileParaResolverTipo = {
  id: string
  plan?: string | null
  booking_duracion_sesion: number | null
  booking_duracion_entrevista: number | null
  booking_precio_sesion: number | null
  booking_precio_entrevista: number | null
  booking_moneda: string | null
}

export async function resolverTipoReserva(
  db: SupabaseClient,
  profile: ProfileParaResolverTipo,
  tipo: string,
  tipoTurnoId?: string | null,
): Promise<TipoResuelto | { error: 'tipo_invalido' }> {
  if (!tipoTurnoId) {
    const duracion = tipo === 'sesion'
      ? (profile.booking_duracion_sesion ?? 50)
      : (profile.booking_duracion_entrevista ?? 30)
    const precio = tipo === 'sesion'
      ? profile.booking_precio_sesion
      : profile.booking_precio_entrevista
    const nombre = tipo === 'sesion' ? 'Sesión' : 'Entrevista inicial'

    return {
      duracion,
      precio,
      moneda: profile.booking_moneda ?? 'ARS',
      tipoTurnoId: null,
      nombre,
    }
  }

  const { puedeUsarTiposTurno } = await import('@/lib/modulos')
  const habilitado = await puedeUsarTiposTurno(db, profile.plan ?? '')
  if (!habilitado) return { error: 'tipo_invalido' }

  const { data: tipoPropio } = await db
    .from('tipos_turno')
    .select('id, nombre, duracion_min, precio, moneda')
    .eq('id', tipoTurnoId)
    .eq('terapeuta_id', profile.id)
    .eq('activo', true)
    .eq('visible_en_booking', true)
    .maybeSingle()

  if (!tipoPropio) return { error: 'tipo_invalido' }

  return {
    duracion: tipoPropio.duracion_min,
    precio: tipoPropio.precio,
    moneda: tipoPropio.moneda,
    tipoTurnoId: tipoPropio.id,
    nombre: tipoPropio.nombre,
  }
}
