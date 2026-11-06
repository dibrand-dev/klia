import { ESPECIALIDADES } from '@/lib/especialidades'
import { Q1_OPCIONES, Q2_OPCIONES, Q2_OTRO, Q2TXT_MAX, Q3_OPCIONES, Q3_OTRO, Q3_MIN, Q3_MAX, Q3TXT_MAX, Q4_OPCIONES } from './preguntas'

// Mismas reglas que el cliente de la landing (klia-landing, fuera de este
// repo) — se revalidan server-side acá porque el endpoint es público.
const CODIGOS_PAIS = ['+54', '+598', '+56', '+595', '+591', '+55', '+51', '+57', '+52', '+34', '+1']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface InscripcionInput {
  nombre_apellido?: unknown
  institucion?: unknown
  email?: unknown
  cc?: unknown
  telefono?: unknown
  especialidad?: unknown
  q1?: unknown
  q2?: unknown
  q2txt?: unknown
  q3?: unknown
  q3txt?: unknown
  q4?: unknown
  consentimiento?: unknown
}

export interface InscripcionValidada {
  nombre_apellido: string
  institucion: string | null
  email: string
  telefono: string
  especialidad: string
  respuestas: {
    q1: string
    q2: string
    q2txt?: string
    q3: string[]
    q3txt?: string
    q4: string
  }
}

export type ResultadoValidacion =
  | { ok: true; data: InscripcionValidada }
  | { ok: false; campos: Record<string, string> }

export function validarInscripcion(body: InscripcionInput): ResultadoValidacion {
  const campos: Record<string, string> = {}

  const nombre = typeof body.nombre_apellido === 'string' ? body.nombre_apellido.trim() : ''
  if (nombre.length < 3) campos.nombre_apellido = 'Ingresá tu nombre y apellido.'

  const emailNormalizado = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_REGEX.test(emailNormalizado)) campos.email = 'Ingresá un email válido.'

  const cc = typeof body.cc === 'string' ? body.cc.trim() : ''
  const telefonoDigitos = typeof body.telefono === 'string' ? body.telefono.replace(/\D/g, '') : ''
  if (!CODIGOS_PAIS.includes(cc)) {
    campos.telefono = 'Seleccioná el código de país.'
  } else if (telefonoDigitos.length < 8) {
    campos.telefono = 'Ingresá un teléfono válido (mínimo 8 dígitos).'
  }

  const especialidad = typeof body.especialidad === 'string' ? body.especialidad : ''
  if (!(ESPECIALIDADES as readonly string[]).includes(especialidad)) campos.especialidad = 'Seleccioná una especialidad válida.'

  const q1 = typeof body.q1 === 'string' ? body.q1 : ''
  if (!(Q1_OPCIONES as readonly string[]).includes(q1)) campos.q1 = 'Respondé esta pregunta.'

  const q2 = typeof body.q2 === 'string' ? body.q2 : ''
  if (!(Q2_OPCIONES as readonly string[]).includes(q2)) {
    campos.q2 = 'Respondé esta pregunta.'
  } else {
    const q2txt = typeof body.q2txt === 'string' ? body.q2txt.trim() : ''
    if (q2 === Q2_OTRO && (!q2txt || q2txt.length > Q2TXT_MAX)) {
      campos.q2txt = `Contanos cuál sistema usás (máx. ${Q2TXT_MAX} caracteres).`
    }
  }

  const q3 = Array.isArray(body.q3) ? body.q3.filter((x): x is string => typeof x === 'string') : []
  const q3Validas = q3.length >= Q3_MIN && q3.length <= Q3_MAX && q3.every((x) => (Q3_OPCIONES as readonly string[]).includes(x))
  if (!q3Validas) {
    campos.q3 = `Elegí entre ${Q3_MIN} y ${Q3_MAX} opciones.`
  } else {
    const q3txt = typeof body.q3txt === 'string' ? body.q3txt.trim() : ''
    if (q3.includes(Q3_OTRO) && (!q3txt || q3txt.length > Q3TXT_MAX)) {
      campos.q3txt = `Contanos cuál (máx. ${Q3TXT_MAX} caracteres).`
    }
  }

  const q4 = typeof body.q4 === 'string' ? body.q4 : ''
  if (!(Q4_OPCIONES as readonly string[]).includes(q4)) campos.q4 = 'Respondé esta pregunta.'

  if (body.consentimiento !== true) campos.consentimiento = 'Tenés que aceptar para poder inscribirte.'

  if (Object.keys(campos).length > 0) return { ok: false, campos }

  const q2txtFinal = typeof body.q2txt === 'string' ? body.q2txt.trim() : ''
  const q3txtFinal = typeof body.q3txt === 'string' ? body.q3txt.trim() : ''

  return {
    ok: true,
    data: {
      nombre_apellido: nombre,
      institucion: typeof body.institucion === 'string' && body.institucion.trim() ? body.institucion.trim() : null,
      email: emailNormalizado,
      telefono: `${cc}${telefonoDigitos}`,
      especialidad,
      respuestas: {
        q1,
        q2,
        ...(q2 === Q2_OTRO && q2txtFinal ? { q2txt: q2txtFinal } : {}),
        q3,
        ...(q3.includes(Q3_OTRO) && q3txtFinal ? { q3txt: q3txtFinal } : {}),
        q4,
      },
    },
  }
}
