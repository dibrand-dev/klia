import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { EstadoTurno } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const ESTADO_TURNO_LABELS: Record<EstadoTurno, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  realizado: 'Realizado',
  no_asistio: 'No asistió',
}

export const ESTADO_TURNO_COLORS: Record<EstadoTurno, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
  realizado: 'bg-green-100 text-green-800 border-green-200',
  no_asistio: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const ESTADO_TURNO_DOT: Record<EstadoTurno, string> = {
  pendiente: 'bg-yellow-400',
  confirmado: 'bg-blue-500',
  cancelado: 'bg-red-500',
  realizado: 'bg-green-500',
  no_asistio: 'bg-gray-400',
}

export function getAvatarClasses(genero: string | null | undefined): string {
  switch (genero) {
    case 'M':    return 'bg-sky-100 text-sky-700'
    case 'F':    return 'bg-pink-100 text-pink-700'
    case 'NB':   return 'bg-gray-200 text-gray-600'
    case 'Otro': return 'bg-orange-100 text-orange-700'
    default:     return 'bg-primary-fixed text-on-primary-fixed'
  }
}

export function formatNombreCompleto(nombre: string, apellido: string) {
  return `${nombre} ${apellido}`.trim()
}

export function formatHora(fecha: string | Date) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatFecha(fecha: string | Date) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}
