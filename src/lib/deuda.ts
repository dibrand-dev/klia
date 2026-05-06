import { type Moneda } from './monedas'

// Determina si una sesión genera deuda para el paciente
// - 'realizado' → siempre genera deuda
// - 'no_asistio' → genera deuda si cobrarInasistencia = true
// - cualquier otro estado → nunca genera deuda
export function sesionGeneraDeuda(estado: string, cobrarInasistencia: boolean): boolean {
  if (estado === 'realizado') return true
  if (estado === 'no_asistio') return cobrarInasistencia
  return false
}

// Resuelve la política de cobro de inasistencias para un paciente
// Prioridad: paciente.cobrar_inasistencias ?? perfil.cobrar_inasistencias
export function resolverPoliticaInasistencia(
  pacienteCobrar: boolean | null | undefined,
  profesionalCobrar: boolean
): boolean {
  return pacienteCobrar ?? profesionalCobrar
}

// Calcula el resumen de deuda de un paciente para un período
export function calcularDeudaMes(
  turnos: Array<{
    estado: string
    monto: number | null
    moneda: string
    pagado: boolean
  }>,
  cobrarInasistencia: boolean
): {
  sesionesCobrables: number
  montoTotal: Partial<Record<Moneda, number>>
  montoCobrado: Partial<Record<Moneda, number>>
  montoPendiente: Partial<Record<Moneda, number>>
} {
  const montoTotal: Partial<Record<Moneda, number>> = {}
  const montoCobrado: Partial<Record<Moneda, number>> = {}
  const montoPendiente: Partial<Record<Moneda, number>> = {}
  let sesionesCobrables = 0

  for (const t of turnos) {
    if (!sesionGeneraDeuda(t.estado, cobrarInasistencia)) continue
    sesionesCobrables++
    if (t.monto == null) continue
    const m = (t.moneda || 'ARS') as Moneda
    montoTotal[m] = (montoTotal[m] ?? 0) + t.monto
    if (t.pagado) {
      montoCobrado[m] = (montoCobrado[m] ?? 0) + t.monto
    } else {
      montoPendiente[m] = (montoPendiente[m] ?? 0) + t.monto
    }
  }

  return { sesionesCobrables, montoTotal, montoCobrado, montoPendiente }
}
