// Traduce errores de Supabase sobre la tabla `turnos` a un mensaje claro en
// español para mostrar en la UI. El trigger de overlap en Supabase devuelve
// un mensaje técnico con el prefijo "TURNO_OVERLAP" (ej. "TURNO_OVERLAP: Ya
// existe un turno en ese horario") — nunca mostrar ese texto técnico tal
// cual, ni en la UI ni en ningún lugar visible para el usuario final.
// Loguear el mensaje original solo server-side (console.error) o en la
// consola del navegador para debug, nunca devolverlo al cliente sin pasar
// por este helper.

export const MENSAJE_TURNO_OVERLAP =
  'Este horario se superpone con otro turno. Revisá la agenda o cargalo como sobreturno.'
export const MENSAJE_TURNO_GENERICO =
  'No se pudo actualizar el turno. Intentá de nuevo y, si persiste, avisanos.'

export function esOverlapTurno(mensaje: string | null | undefined): boolean {
  return !!mensaje?.includes('TURNO_OVERLAP')
}

export function mensajeErrorTurno(mensaje: string | null | undefined): string {
  return esOverlapTurno(mensaje) ? MENSAJE_TURNO_OVERLAP : MENSAJE_TURNO_GENERICO
}
