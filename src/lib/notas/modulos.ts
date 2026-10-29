// Metadata por especialidad del módulo de nota clínica — puerto de los
// campos `titulo`/`nota` del objeto MODULOS del diseño de referencia. Claves
// = strings EXACTOS de src/lib/especialidades.ts.
//
// La UI de campos y los cálculos en vivo de cada especialidad viven en
// src/components/notas/modulos/*.tsx (demasiado heterogéneos — odontograma,
// escala EVA, chips CIE-10, etc. — para expresarlos como config genérica sin
// sobre-ingeniería). Este archivo es solo el mapeo título/placeholder que
// usa el header del módulo y el placeholder de la nota de sesión.

export type ValoresModulo = Record<string, string | string[]>

interface MetaEspecialidad {
  titulo: string
  notaPlaceholder: string
}

export const META_MODULOS: Record<string, MetaEspecialidad> = {
  Nutrición: {
    titulo: 'Datos antropométricos',
    notaPlaceholder: '¿Qué trabajaron en esta sesión? Temas tratados, evolución, próximos pasos...',
  },
  Oftalmología: {
    titulo: 'Examen oftalmológico',
    notaPlaceholder: 'Motivo de consulta, hallazgos del examen, indicaciones, próximo control…',
  },
  Kinesiología: {
    titulo: 'Evaluación kinésica',
    notaPlaceholder: 'Técnicas aplicadas, respuesta del paciente, ejercicios indicados, próximos pasos…',
  },
  Odontología: {
    titulo: 'Prestación odontológica',
    notaPlaceholder: 'Procedimiento realizado, materiales, indicaciones, próximo turno…',
  },
  Psicología: {
    titulo: 'Escalas y riesgo',
    notaPlaceholder: '¿Qué trabajaron en esta sesión? Temas tratados, evolución, próximos pasos...',
  },
  'Clínica Médica': {
    titulo: 'Signos vitales',
    notaPlaceholder: 'Motivo de consulta, examen físico, diagnóstico, indicaciones…',
  },
}

export const NOTA_PLACEHOLDER_DEFAULT = 'Motivo de consulta, hallazgos, indicaciones, próximos pasos…'

export function metaModulo(especialidad: string | null | undefined): MetaEspecialidad | null {
  if (!especialidad) return null
  return META_MODULOS[especialidad] ?? null
}

export function notaPlaceholder(especialidad: string | null | undefined): string {
  return metaModulo(especialidad)?.notaPlaceholder ?? NOTA_PLACEHOLDER_DEFAULT
}
