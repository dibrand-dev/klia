// Lista única de comidas "libres" (modo sin plan alimentario) — fuente de
// verdad para la API del portal (validación de tipo_comida) y para la UI
// (orden de las filas en Hoy). Nunca duplicar este array en otro archivo.
export const COMIDAS_LIBRES = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Colación'] as const

export type ComidaLibre = typeof COMIDAS_LIBRES[number]

export function esComidaLibre(valor: string): valor is ComidaLibre {
  return (COMIDAS_LIBRES as readonly string[]).includes(valor)
}

// Única comida libre que admite varios registros por día — el resto va uno
// por día (índice parcial portal_registros_slot_libre_uq en la base).
export const COMIDA_LIBRE_MULTIPLE: ComidaLibre = 'Colación'
