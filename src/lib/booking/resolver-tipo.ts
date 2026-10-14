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
  booking_sesion_visible?: boolean | null
  booking_entrevista_visible?: boolean | null
  booking_moneda: string | null
}

// Con 2+ sedes activas, el flujo público siempre fuerza elegir una sede
// antes de llegar al tipo — así que acá una sedeId ausente o inválida es una
// reserva malformada, sea el tipo base o propio. Con 0–1 sedes no se exige
// ni se valida nada (sedeId, si vino, se ignora). `null` = sedeId requerida
// y ausente/inválida (el caller debe cortar con tipo_invalido); con 2+ sedes
// y sedeId válida, devuelve su id ya confirmado.
type SedeCheck = { suficiente: false } | { suficiente: true; sedeId: string }

async function resolverSedeActiva(
  db: SupabaseClient,
  terapeutaId: string,
  sedeId?: string | null,
): Promise<SedeCheck | null> {
  const { count: sedesActivasCount } = await db
    .from('sucursales')
    .select('id', { count: 'exact', head: true })
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)

  if ((sedesActivasCount ?? 0) < 2) return { suficiente: false }

  if (!sedeId) return null

  const { data: sedeValida } = await db
    .from('sucursales')
    .select('id')
    .eq('id', sedeId)
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)
    .maybeSingle()
  if (!sedeValida) return null

  return { suficiente: true, sedeId: sedeValida.id }
}

// Regla de negocio (link público, Ajustes y Agenda): con 2+ sedes activas,
// un tipo propio sin filas en tipos_turno_sucursales no se ofrece — hay que
// pasar una sedeId válida (sucursal activa del profesional) con una fila
// para ese tipo. Con 0–1 sedes activas no se filtra nada.
export async function validarTipoSede(
  db: SupabaseClient,
  terapeutaId: string,
  tipoTurnoId: string,
  sedeId?: string | null,
): Promise<boolean> {
  const sedeCheck = await resolverSedeActiva(db, terapeutaId, sedeId)
  if (!sedeCheck) return false
  if (!sedeCheck.suficiente) return true

  const { data: asignacion } = await db
    .from('tipos_turno_sucursales')
    .select('tipo_turno_id')
    .eq('tipo_turno_id', tipoTurnoId)
    .eq('sucursal_id', sedeCheck.sedeId)
    .maybeSingle()

  return !!asignacion
}

// "Hay tipos propios ofertados" = el plan habilita tipos_turno Y existe al
// menos uno activo + visible_en_booking — el mismo criterio que arma
// tiposPropios en /p/[slug]/page.tsx. Con un downgrade a un plan que ya no
// habilita tipos_turno, esto pasa a false sin tocar ninguna fila de
// tipos_turno en la base.
async function hayTiposPropiosOfertados(
  db: SupabaseClient,
  terapeutaId: string,
  plan?: string | null,
): Promise<boolean> {
  const { puedeUsarTiposTurno } = await import('@/lib/modulos')
  if (!(await puedeUsarTiposTurno(db, plan ?? ''))) return false

  const { count } = await db
    .from('tipos_turno')
    .select('id', { count: 'exact', head: true })
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)
    .eq('visible_en_booking', true)

  return (count ?? 0) > 0
}

export async function resolverTipoReserva(
  db: SupabaseClient,
  profile: ProfileParaResolverTipo,
  tipo: string,
  tipoTurnoId?: string | null,
  sedeId?: string | null,
): Promise<TipoResuelto | { error: 'tipo_invalido' }> {
  if (!tipoTurnoId) {
    // Los tipos base no se filtran POR sede, pero con 2+ sedes activas el
    // flujo siempre pasa por Sede antes de llegar a Tipo — una sedeId
    // ausente o inválida en ese caso es una reserva malformada, nunca se
    // crea un turno con sucursal_id null para un profesional multi-sede.
    const sedeCheck = await resolverSedeActiva(db, profile.id, sedeId)
    if (!sedeCheck) return { error: 'tipo_invalido' }

    // Sin tipos propios ofertados, el flag de Sesión/Entrevista nunca puede
    // ser el único motivo de que el link quede sin ningún tipo disponible —
    // se ignora (se trata como visible) sin modificar el dato guardado.
    const ofertados = await hayTiposPropiosOfertados(db, profile.id, profile.plan)
    const visible = tipo === 'sesion'
      ? ((profile.booking_sesion_visible ?? true) || !ofertados)
      : ((profile.booking_entrevista_visible ?? true) || !ofertados)
    if (!visible) return { error: 'tipo_invalido' }

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

  const sedeOk = await validarTipoSede(db, profile.id, tipoPropio.id, sedeId)
  if (!sedeOk) return { error: 'tipo_invalido' }

  return {
    duracion: tipoPropio.duracion_min,
    precio: tipoPropio.precio,
    moneda: tipoPropio.moneda,
    tipoTurnoId: tipoPropio.id,
    nombre: tipoPropio.nombre,
  }
}
