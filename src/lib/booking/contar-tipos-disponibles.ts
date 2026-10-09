// Regla del mínimo del link de reservas, compartida entre AjustesClient (toggles
// de Sesión/Entrevista) y TiposTurnoSection (alta/edición de tipos propios): el
// link siempre tiene que ofrecer al menos 1 tipo de consulta.
export type TipoPropioParaConteo = { activo: boolean; visible_en_booking: boolean }

export function contarTiposDisponibles(params: {
  tiposPropios: TipoPropioParaConteo[]
  sesionPrecioCargado: boolean
  sesionVisible: boolean
  entrevistaPrecioCargado: boolean
  entrevistaVisible: boolean
}): number {
  const propiosVisibles = params.tiposPropios.filter((t) => t.activo && t.visible_en_booking).length
  const sesionCuenta = params.sesionPrecioCargado && params.sesionVisible ? 1 : 0
  const entrevistaCuenta = params.entrevistaPrecioCargado && params.entrevistaVisible ? 1 : 0
  return propiosVisibles + sesionCuenta + entrevistaCuenta
}
