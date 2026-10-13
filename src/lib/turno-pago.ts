// Si el turno está pagado no depende de un solo campo: pagado=true es el
// caso directo, pero un pago parcial o un monto_pagado > 0 sin que alguien
// haya seteado el flag `pagado` también cuentan como "hay dinero de por
// medio" a la hora de avisar al profesional en una cancelación.
export function turnoEstaPagado(turno: { pagado: boolean; estado_pago: string | null; monto_pagado: number | null }): boolean {
  return turno.pagado || ['pagado', 'pago_parcial'].includes(turno.estado_pago ?? '') || (turno.monto_pagado ?? 0) > 0
}

export function montoPagadoTurno(turno: { monto_pagado: number | null; monto: number | null }): number | null {
  return turno.monto_pagado || turno.monto
}
