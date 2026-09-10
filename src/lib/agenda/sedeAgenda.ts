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

// ── Abreviaturas de sede ────────────────────────────────────────────────

function palabrasDe(nombre: string): string[] {
  const limpio = nombre.trim().toUpperCase().replace(/[^A-ZÑÁÉÍÓÚ\s]/g, '')
  return limpio.split(/\s+/).filter(Boolean)
}

// Sigla base — igual que antes: 1ra letra de cada una de las primeras 3
// palabras (o las primeras 3 letras si el nombre es una sola palabra).
function siglaBase(nombre: string): string {
  const palabras = palabrasDe(nombre)
  if (palabras.length === 0) return '—'
  if (palabras.length === 1) return palabras[0].slice(0, 3)
  return palabras.slice(0, 3).map(p => p[0]).join('')
}

// Crece progresivamente la sigla tomando más letras de la última palabra
// incluida (la que suele distinguir mejor, ej. "Palermo" vs "principal" ya
// difieren en la 2da letra: PA vs PR) y, si esa palabra se agota, retrocede
// a la anterior. `nivel` es cuántas letras extra sumar en total.
function siglaConNivel(nombre: string, nivel: number): string | null {
  const palabras = palabrasDe(nombre)
  if (palabras.length === 0) return '—'
  if (palabras.length === 1) {
    const letras = Math.min(3 + nivel, palabras[0].length)
    return palabras[0].slice(0, letras)
  }
  const nPalabras = Math.min(palabras.length, 3)
  const letrasPorPalabra = Array(nPalabras).fill(1)
  let restante = nivel
  let idx = nPalabras - 1
  while (restante > 0) {
    if (letrasPorPalabra[idx] < palabras[idx].length) {
      letrasPorPalabra[idx]++
      restante--
    } else {
      idx--
      if (idx < 0) return null // no queda de dónde tomar más letras
    }
  }
  return palabras.slice(0, nPalabras).map((p, i) => p.slice(0, letrasPorPalabra[i])).join('')
}

const MAX_NIVEL_CRECIMIENTO = 12

// Genera una sigla única por sede dentro de un mismo profesional (las sedes
// ya vienen filtradas por terapeuta_id desde /api/sedes, así que "único" acá
// es único por profesional). Ante colisión (ej. "Consultorio principal" y
// "Consultorio Palermo", ambas "CP" con la sigla base), la primera sede en
// el orden recibido conserva la sigla base y las siguientes se desambiguan
// tomando progresivamente más letras (CP → CPR / CPA). Si dos nombres son
// literalmente idénticos y no hay más letras de dónde tomar, cae a un
// sufijo numérico (CP, CP2, CP3...) como último recurso.
export function abreviaturasUnicas(sedes: { id: string; nombre: string }[]): Record<string, string> {
  const resultado: Record<string, string> = {}
  const usadas = new Set<string>()
  for (const sede of sedes) {
    let sigla: string | null = null
    for (let nivel = 0; nivel <= MAX_NIVEL_CRECIMIENTO; nivel++) {
      const candidata = siglaConNivel(sede.nombre, nivel)
      if (candidata && !usadas.has(candidata)) {
        sigla = candidata
        break
      }
    }
    if (!sigla) {
      const base = siglaBase(sede.nombre)
      let n = 2
      let candidata = `${base}${n}`
      while (usadas.has(candidata)) {
        n++
        candidata = `${base}${n}`
      }
      sigla = candidata
    }
    usadas.add(sigla)
    resultado[sede.id] = sigla
  }
  return resultado
}
