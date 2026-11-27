// Parseo/formateo/validación de fechas DD/MM/AAAA para el input de fecha de
// nacimiento (profesional, paciente y reserva pública) — funciones puras,
// sin React, para que FechaNacimientoInput.tsx las use y se puedan testear
// aparte. El valor externo (lo que se guarda en Supabase) sigue siendo ISO
// yyyy-mm-dd; estas funciones solo convierten hacia/desde esa forma.

// Deja solo los dígitos tipeados/pegados, con o sin separadores (/, -, espacio),
// y los va agrupando en DD/MM/AAAA a medida que entran. Tolera pegado completo
// ("15/03/1985", "15-03-1985", "15031985") porque arranca igual: sacar los
// dígitos y reordenar.
export function formatearMientrasEscribe(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8)
  const dd = digitos.slice(0, 2)
  const mm = digitos.slice(2, 4)
  const aaaa = digitos.slice(4, 8)
  let salida = dd
  if (digitos.length > 2) salida += '/' + mm
  if (digitos.length > 4) salida += '/' + aaaa
  return salida
}

// ISO (yyyy-mm-dd) → texto para mostrar (dd/mm/aaaa). '' si no es ISO válido.
export function isoADisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return ''
  const [, aaaa, mm, dd] = m
  return `${dd}/${mm}/${aaaa}`
}

// Texto dd/mm/aaaa (con o sin barras) → ISO yyyy-mm-dd, solo si:
// - tiene los 8 dígitos (día + mes + año completos),
// - es una fecha real (rechaza 31/02, 31/04, etc.),
// - no es futura,
// - el año es >= 1900.
// Devuelve null si está incompleta o es inválida por cualquiera de esos motivos.
export function displayAIso(display: string): string | null {
  const digitos = display.replace(/\D/g, '')
  if (digitos.length !== 8) return null

  const dd = Number(digitos.slice(0, 2))
  const mm = Number(digitos.slice(2, 4))
  const aaaa = Number(digitos.slice(4, 8))
  if (aaaa < 1900) return null

  // Construida en UTC para no depender de la zona horaria del navegador —
  // mismo patrón que validarFechaNacimientoReserva en
  // src/lib/booking/validar-datos-reserva.ts.
  const fecha = new Date(Date.UTC(aaaa, mm - 1, dd))
  if (fecha.getUTCFullYear() !== aaaa || fecha.getUTCMonth() !== mm - 1 || fecha.getUTCDate() !== dd) return null

  const hoy = new Date()
  const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  if (fecha.getTime() > hoyUTC.getTime()) return null

  const pad = (n: number, len: number) => String(n).padStart(len, '0')
  return `${pad(aaaa, 4)}-${pad(mm, 2)}-${pad(dd, 2)}`
}
