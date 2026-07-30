import type { RegistroRefraccion } from '@/types/database'

type CamposReceta = Pick<
  RegistroRefraccion,
  'sph_od' | 'cyl_od' | 'axis_od' | 'av_od' | 'add_od' | 'sph_oi' | 'cyl_oi' | 'axis_oi' | 'av_oi' | 'add_oi'
>

export function recetaCompleta(receta: CamposReceta): boolean {
  return (
    receta.sph_od !== null &&
    receta.cyl_od !== null &&
    receta.axis_od !== null &&
    receta.av_od !== null &&
    receta.add_od !== null &&
    receta.sph_oi !== null &&
    receta.cyl_oi !== null &&
    receta.axis_oi !== null &&
    receta.av_oi !== null &&
    receta.add_oi !== null
  )
}

export function formatearDioptrias(valor: number | null): string {
  if (valor === null) return '—'
  return valor > 0 ? `+${valor.toFixed(2)}` : valor.toFixed(2)
}
