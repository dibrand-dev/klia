// Normalización pura para detección de pacientes duplicados — sin dependencias
// de Supabase ni de Next. Reusada entre /api/pacientes/verificar-duplicado y
// /api/booking/crear.

export function normalizarDni(dni: string | null | undefined): string | null {
  if (!dni) return null
  const digitos = dni.replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

export function normalizarEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const limpio = email.trim().toLowerCase()
  return limpio.length > 0 ? limpio : null
}

// Sin tildes, minúsculas, espacios internos colapsados y recortados en los
// bordes — para comparar "María José" contra "maria   jose" como la misma
// persona.
export function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return ''
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
