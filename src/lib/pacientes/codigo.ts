// Código corto mostrado al profesional para identificar un paciente (ficha,
// listado, nombre de archivo de la HC) — derivado del id, nunca una columna
// propia.
export function codigoPaciente(id: string): string {
  return `PAC-${id.slice(0, 8).toUpperCase()}`
}
