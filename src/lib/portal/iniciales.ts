// Iniciales para el avatar del comentario del profesional — a partir del
// nombre completo ya formateado ("Nombre Apellido"), no de columnas sueltas,
// para no duplicar el criterio de armado del nombre en cada caller.
export function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const primera = partes[0][0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : ''
  return (primera + ultima).toUpperCase()
}
