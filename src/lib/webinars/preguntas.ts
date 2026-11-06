// Única fuente de verdad de las 4 preguntas fijas de inscripción a webinars
// (iguales para todos los webinars) — usado por la validación del endpoint
// público y, si en algún momento se necesita, por la UI de inscriptos en OPS.

export const Q1_OPCIONES = ['Menos de 20', '20 a 50', '51 a 100', '101 a 200', 'Más de 200'] as const
export type Q1Opcion = (typeof Q1_OPCIONES)[number]

export const Q2_OPCIONES = [
  'No, lo manejaba en papel/cuaderno',
  'Excel o Google Sheets',
  'Agenda de Google o del celular + WhatsApp',
  'Un sistema de gestión (¿cuál?)',
  'Ninguna',
] as const
export type Q2Opcion = (typeof Q2_OPCIONES)[number]
export const Q2_OTRO: Q2Opcion = 'Un sistema de gestión (¿cuál?)'
export const Q2TXT_MAX = 60

export const Q3_OPCIONES = [
  'Cobrar y hacer seguimiento de deudas',
  'Cancelaciones y ausencias de pacientes',
  'Gestionar pacientes nuevos',
  'Tareas administrativas manuales',
  'Historias clínicas en papel o desordenadas',
  'Facturación a obras sociales o prepagas',
  'Facturación electrónica (ARCA)',
  'Conseguir más pacientes',
  'Otro',
] as const
export type Q3Opcion = (typeof Q3_OPCIONES)[number]
export const Q3_OTRO: Q3Opcion = 'Otro'
export const Q3_MIN = 1
export const Q3_MAX = 3
export const Q3TXT_MAX = 120

export const Q4_OPCIONES = [
  'Independiente, con consultorio propio',
  'En una clínica o centro de salud',
  'En ambos',
] as const
export type Q4Opcion = (typeof Q4_OPCIONES)[number]

export interface RespuestasWebinar {
  q1: Q1Opcion
  q2: Q2Opcion
  q2txt?: string
  q3: Q3Opcion[]
  q3txt?: string
  q4: Q4Opcion
}
