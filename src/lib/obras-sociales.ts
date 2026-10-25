export { OBRAS_SOCIALES_AR as OBRAS_SOCIALES } from '@/lib/data/salud-ar'

function normalizarNombreOS(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Combina listas de nombres de obra social sin duplicados (comparación sin
// mayúsculas/tildes, se conserva el primer casing visto para cada nombre) y
// ordenadas alfabéticamente.
export function combinarObrasSociales(...listas: string[][]): string[] {
  const vistos = new Set<string>()
  const resultado: string[] = []
  for (const lista of listas) {
    for (const nombre of lista) {
      const limpio = nombre.trim()
      if (!limpio) continue
      const key = normalizarNombreOS(limpio)
      if (vistos.has(key)) continue
      vistos.add(key)
      resultado.push(limpio)
    }
  }
  return resultado.sort((a, b) => a.localeCompare(b, 'es'))
}
