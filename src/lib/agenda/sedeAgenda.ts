// Lógica pura de agenda multi-sede — sin dependencias de React ni Supabase.
// Puramente informativa: nada acá valida ni bloquea la creación/edición de
// turnos (ver NuevoTurnoPageForm.tsx, que esta feature no toca).

export const UMBRAL_TRASLADO_MIN = 30

export interface TurnoConSedeMin {
  id: string
  sucursal_id: string | null
  inicioMin: number // minutos desde medianoche
  finMin: number
}

export interface TrasladoCorto {
  finAnteriorMin: number
  inicioSiguienteMin: number
  minutos: number
  sedeOrigenId: string
  sedeDestinoId: string
}

// Detecta transiciones entre sedes distintas con margen <= umbral, comparando
// turnos consecutivos en orden cronológico global del día (no por columna).
// Un turno sin sucursal_id (turnos creados antes de esta feature, o sin sede
// asignada) nunca genera alerta — no hay con qué sede compararlo.
export function calcularTraslados(turnos: TurnoConSedeMin[], umbralMin = UMBRAL_TRASLADO_MIN): TrasladoCorto[] {
  const ordenados = [...turnos].sort((a, b) => a.inicioMin - b.inicioMin)
  const out: TrasladoCorto[] = []
  for (let i = 0; i < ordenados.length - 1; i++) {
    const actual = ordenados[i]
    const siguiente = ordenados[i + 1]
    if (!actual.sucursal_id || !siguiente.sucursal_id) continue
    if (actual.sucursal_id === siguiente.sucursal_id) continue
    const margen = siguiente.inicioMin - actual.finMin
    if (margen >= 0 && margen <= umbralMin) {
      out.push({
        finAnteriorMin: actual.finMin,
        inicioSiguienteMin: siguiente.inicioMin,
        minutos: margen,
        sedeOrigenId: actual.sucursal_id,
        sedeDestinoId: siguiente.sucursal_id,
      })
    }
  }
  return out
}

// Con 5+ sedes activas, "Por sede" en Día cae al mismo patrón de filtro que
// Semana (selector de una sede) en vez de columnas — decisión explícita del
// pedido, no del diseño de referencia (que no cubre este caso).
export const BREAKPOINT_COLUMNAS_A_FILTRO = 5

export const PREF_KEY_SCOPE = 'klia.agenda.scope'
export const PREF_KEY_SEDE = 'klia.agenda.sede'

export type AgendaScope = 'todas' | 'sede'

// Persistencia puramente client-side (localStorage) — a propósito, sin
// sincronización entre dispositivos ni por profesional en el servidor: una
// colaboradora y el profesional son usuarios distintos viendo la misma
// agenda, y una preferencia server-side forzaría la misma vista a ambos.
export function leerPreferenciaAgenda(): { scope: AgendaScope; sedeId: string | null } {
  if (typeof window === 'undefined') return { scope: 'todas', sedeId: null }
  try {
    const scope = localStorage.getItem(PREF_KEY_SCOPE)
    const sedeId = localStorage.getItem(PREF_KEY_SEDE)
    return { scope: scope === 'sede' ? 'sede' : 'todas', sedeId: sedeId || null }
  } catch {
    return { scope: 'todas', sedeId: null }
  }
}

export function guardarPreferenciaAgenda(scope: AgendaScope, sedeId: string | null) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PREF_KEY_SCOPE, scope)
    if (sedeId) localStorage.setItem(PREF_KEY_SEDE, sedeId)
  } catch {
    // localStorage puede fallar (modo privado, cuota) — la preferencia
    // simplemente no persiste, no es crítico para el funcionamiento.
  }
}
