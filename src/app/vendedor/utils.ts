// Helpers compartidos del panel de vendedores — formato de fecha/moneda,
// badges y clasificación de estado. Todo a partir de columnas reales de las
// RPC (nunca inventa datos que no vienen de la base).

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const money = (n: number | null | undefined): string => `$ ${Math.round(n ?? 0).toLocaleString('es-AR')}`

export function fd(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso)
  return `${t.getDate()} ${MES[t.getMonth()]} ${t.getFullYear()}`
}

export function fds(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso)
  return `${t.getDate()} ${MES[t.getMonth()]}`
}

export function mesLargo(iso: string): string {
  const [a, m] = iso.slice(0, 7).split('-')
  return `${MESL[Number(m) - 1]} ${a}`
}

export function rel(iso: string | null | undefined): string {
  if (!iso) return 'Nunca'
  const t = new Date(iso)
  const dias = Math.round((Date.now() - t.getTime()) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem.`
  return fd(iso)
}

export function iniciales(nombre: string, apellido: string): string {
  return `${(nombre[0] ?? '').toUpperCase()}${(apellido[0] ?? '').toUpperCase()}`
}

export function nombreCompleto(nombre: string, apellido: string): string {
  return `${nombre} ${apellido}`.trim()
}

const PALETA_AVATAR = ['#D6E0F5', '#D5EFDF', '#FFF1D6', '#E8DAFF', '#FFD3CC']
export function colorAvatar(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % PALETA_AVATAR.length
  return PALETA_AVATAR[Math.abs(h)]
}

export type EstadoCliente = 'trial' | 'pagando' | 'bloqueado'

// La RPC devuelve profiles.estado_cuenta tal cual ('trial' | 'activa' |
// 'bloqueada' | 'cancelada') — se agrupa a las 3 categorías visibles del
// panel; 'cancelada' se trata como bloqueado (no hay bucket propio).
export function estadoCliente(estadoCuenta: string): EstadoCliente {
  if (estadoCuenta === 'trial') return 'trial'
  if (estadoCuenta === 'bloqueada' || estadoCuenta === 'cancelada') return 'bloqueado'
  return 'pagando'
}

export const ESTADO_LABEL: Record<EstadoCliente, string> = { trial: 'Trial', pagando: 'Pagando', bloqueado: 'Bloqueado' }

export function diasLabel(dias: number | null): string {
  if (dias == null) return '—'
  if (dias < 0) return 'Vencido'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

export function diasClase(dias: number | null): string {
  if (dias == null) return 'dn'
  return dias <= 1 ? 'd1' : dias <= 7 ? 'd7' : 'dn'
}

export function waUrl(telefono: string | null, mensaje: string): string {
  const n = (telefono ?? '').replace(/\D/g, '')
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
}

export function mailUrl(email: string, asunto: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(asunto)}`
}
