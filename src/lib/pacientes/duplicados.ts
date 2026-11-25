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

// Para usar un valor como filtro ilike sin que %, _ o \ actúen como comodín/escape.
export function escaparIlike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`)
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

export type CandidatoDedupe = {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  activo: boolean
  created_at: string
}

// Elegir qué paciente existente reusar entre varios candidatos con el mismo
// email (ej. una familia que comparte casilla) — nunca crea uno nuevo si hay
// candidatos. Orden de prioridad:
// 1. Activo cuyo DNI normalizado coincide con el de la reserva (solo si la
//    reserva trae DNI) — el dato más confiable para distinguir personas.
// 2. Activo con nombre y apellido normalizados iguales.
// 3. Activo más antiguo, o si no hay ninguno activo, el inactivo más
//    antiguo (se reactiva).
export function elegirPacienteExistente<T extends CandidatoDedupe>(
  candidatos: T[],
  nombre: string,
  apellido: string,
  dniReserva: string | null,
): T | null {
  const ordenados = candidatos.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
  const activos = ordenados.filter((p) => p.activo)

  if (dniReserva) {
    const porDni = activos.find((p) => normalizarDni(p.dni) === dniReserva)
    if (porDni) return porDni
  }

  const nombreBuscado = normalizarNombre(nombre)
  const apellidoBuscado = normalizarNombre(apellido)

  return (
    activos.find((p) => normalizarNombre(p.nombre) === nombreBuscado && normalizarNombre(p.apellido) === apellidoBuscado)
    ?? activos[0]
    ?? ordenados[0]
    ?? null
  )
}
