export function estadoAutorizacion(fechaHasta: string | null): { label: string; tono: 'vencida' | 'porVencer' } | null {
  if (!fechaHasta) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(fechaHasta + 'T00:00:00')
  const dias = Math.round((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { label: 'Autorización vencida', tono: 'vencida' }
  if (dias <= 7) return { label: dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'}`, tono: 'porVencer' }
  return null
}
