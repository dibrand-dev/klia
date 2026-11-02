// Criterio único de orden para comidas e ítems de un plan alimentario —
// usado por obtenerDatosPlanAlimentario (Mi plan del portal + /p/plan/[token]),
// /api/portal/hoy y la solapa Registro del profesional, para que las tres
// muestren siempre el mismo orden. Se ordena en JS después de leer de
// Supabase (no con .order() de PostgREST) porque plan_comida_items va
// anidado dos niveles adentro de planes_alimentarios, y encadenar .order()
// con foreignTable en un embed así de profundo no es confiable.
export interface ComidaOrdenable {
  id: string
  orden: number
  hora: string | null
}

export interface ItemOrdenable {
  id: string
  orden: number
}

// orden asc → hora asc (null al final) → id asc, como desempate final estable.
export function compararComidas(a: ComidaOrdenable, b: ComidaOrdenable): number {
  if (a.orden !== b.orden) return a.orden - b.orden
  const horaA = a.hora ?? '99:99:99'
  const horaB = b.hora ?? '99:99:99'
  if (horaA !== horaB) return horaA < horaB ? -1 : 1
  return a.id.localeCompare(b.id)
}

// orden asc → id asc.
export function compararItems(a: ItemOrdenable, b: ItemOrdenable): number {
  if (a.orden !== b.orden) return a.orden - b.orden
  return a.id.localeCompare(b.id)
}
