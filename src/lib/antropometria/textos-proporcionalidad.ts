// PENDIENTE VALIDACIÓN (nutricionista): etiquetas y descripciones de P4 (proporcionalidad
// ósea), portadas del diseño del informe profesional (cormCat/manuCat/envCat de
// isak-data.js). Las funciones de categoría (categoriaCormico/categoriaManouvrier/
// categoriaEnvergadura, en calculos.ts) siguen siendo la fuente de la clasificación —
// este archivo solo mapea esas keys a los textos que muestra el informe.
import type { categoriaCormico, categoriaManouvrier, categoriaEnvergadura } from './calculos'

export interface TextoCategoria { etiqueta: string; descripcion?: string }

export const TEXTOS_CORMICO: Record<ReturnType<typeof categoriaCormico>, TextoCategoria> = {
  'braquicórmico': { etiqueta: 'Braquicórmico', descripcion: 'Tronco corto en relación con la talla' },
  'metricórmico': { etiqueta: 'Metriocórmico', descripcion: 'Tronco proporcionado a la talla' },
  'macrocórmico': { etiqueta: 'Macrocórmico', descripcion: 'Tronco largo en relación con la talla' },
}

export const TEXTOS_MANOUVRIER: Record<ReturnType<typeof categoriaManouvrier>, TextoCategoria> = {
  'miembros inferiores cortos': { etiqueta: 'Braquiesquélico', descripcion: 'Miembros inferiores cortos' },
  'miembros inferiores medios': { etiqueta: 'Mesoesquélico', descripcion: 'Miembros inferiores intermedios' },
  'miembros inferiores largos': { etiqueta: 'Macroesquélico', descripcion: 'Miembros inferiores largos' },
}

export const TEXTOS_ENVERGADURA: Record<ReturnType<typeof categoriaEnvergadura>, TextoCategoria> = {
  'menor a la talla': { etiqueta: 'Menor a la talla' },
  'igual a la talla': { etiqueta: 'Igual a la talla' },
  'mayor a la talla': { etiqueta: 'Mayor a la talla' },
}

/** Referencias de corte que muestra la caja "Referencias" de P4. */
export const REFERENCIA_CORMICO = 'Braquicórmico < 0,51 · Metriocórmico 0,51–0,53 · Macrocórmico > 0,53'
export const REFERENCIA_MANOUVRIER = 'Braquiesquélico < 85 · Mesoesquélico 85–89,9 · Macroesquélico ≥ 90'
export const REFERENCIA_ENVERGADURA = 'Menor, igual o mayor a la talla (1,00)'
