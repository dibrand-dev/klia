/**
 * Registro central de generadores de planilla custom.
 * Para agregar un nuevo generador: añadir una entrada aquí y crear
 * src/lib/planillas/{endpoint}.ts + src/app/api/planillas/{endpoint}/route.ts
 */
export interface GeneradorCustom {
  /** Fragmento del nombre de OS (lowercase, para includes()) */
  match: string
  /** Label para mostrar en la UI */
  label: string
  /** Path del API route */
  endpoint: string
}

export const GENERADORES_CUSTOM: GeneradorCustom[] = [
  { match: 'hospital italiano', label: 'Hospital Italiano', endpoint: '/api/planillas/hospital-italiano' },
  { match: 'ioma',              label: 'IOMA',              endpoint: '/api/planillas/ioma' },
  { match: 'swiss medical',     label: 'Swiss Medical',     endpoint: '/api/planillas/swiss-medical' },
]

export function detectarGeneradorCustom(nombreOS: string): GeneradorCustom | null {
  const lower = nombreOS.toLowerCase()
  return GENERADORES_CUSTOM.find(g => lower.includes(g.match)) ?? null
}
