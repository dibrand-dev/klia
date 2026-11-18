// Distribución adiposo/muscular (pedido de la nutricionista, 2026-11). Fórmulas deducidas
// de un informe de referencia y exactas en ese caso; pendientes de validar con otras
// evaluaciones. Librería pura: sin dependencias, sin I/O.

type N = number | null | undefined

const num = (v: N): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export interface DistribucionAdiposo { superior: number | null; central: number | null; inferior: number | null }
export interface DistribucionMuscular { brazo: number | null; muslo: number | null; pierna: number | null }

export interface DistribucionAdiposoMuscular {
  adiposo: DistribucionAdiposo | null
  muscular: DistribucionMuscular | null
}

interface MedidasDistribucion {
  triceps?: N; subescapular?: N; supraespinal?: N; abdominal?: N; muslo?: N; pantorrilla?: N
  brazoCorregido?: N; musloCorregido?: N; piernaCorregida?: N
}

/**
 * Distribución adiposo/muscular: cada grupo adiposo sobre Σ6, cada perímetro corregido
 * sobre la suma de los 3. null en el grupo completo si falta algún dato (nunca se calcula
 * con datos inventados). Sin redondeo — redondear solo al mostrar.
 */
export function distribucionAdiposoMuscular(m: MedidasDistribucion): DistribucionAdiposoMuscular {
  const tri = num(m.triceps), sub = num(m.subescapular), sup = num(m.supraespinal)
  const abd = num(m.abdominal), mus = num(m.muslo), pan = num(m.pantorrilla)

  let adiposo: DistribucionAdiposo | null = null
  if (tri !== null && sub !== null && sup !== null && abd !== null && mus !== null && pan !== null) {
    const s6 = tri + sub + sup + abd + mus + pan
    if (s6 > 0) {
      adiposo = {
        superior: ((tri + sub) / s6) * 100,
        central: ((sup + abd) / s6) * 100,
        inferior: ((mus + pan) / s6) * 100,
      }
    }
  }

  const cBrazo = num(m.brazoCorregido), cMuslo = num(m.musloCorregido), cPierna = num(m.piernaCorregida)
  let muscular: DistribucionMuscular | null = null
  if (cBrazo !== null && cMuslo !== null && cPierna !== null) {
    const suma = cBrazo + cMuslo + cPierna
    if (suma > 0) {
      muscular = {
        brazo: (cBrazo / suma) * 100,
        muslo: (cMuslo / suma) * 100,
        pierna: (cPierna / suma) * 100,
      }
    }
  }

  return { adiposo, muscular }
}
