import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { normalizarDni } from '@/lib/pacientes/duplicados'
import { consultarPractitioner, codigoRefeps, BusConsultaError } from '@/lib/refeps/bus'
import { mapQualifications } from '@/lib/refeps/mapear-qualifications'
import type { FhirPractitioner, MatriculaMapeada, RefepsValidationResponse } from '@/types/sisa'

export const runtime = 'nodejs'

const LIMITE_INTENTOS_POR_HORA = 5
const UNA_HORA_MS = 60 * 60 * 1000

type DbClient = ReturnType<typeof serviceClient>

async function registrarVerificacion(
  db: DbClient,
  args: {
    profesionalId: string
    codigoRefeps: string
    estado: string
    httpStatus: number | null
    practitionerId: string | null
    respuesta: FhirPractitioner | null
    consentimientoAt: string | null
  },
) {
  const { error } = await db.from('refeps_verificaciones').insert({
    profesional_id: args.profesionalId,
    codigo_refeps: args.codigoRefeps,
    estado: args.estado,
    http_status: args.httpStatus,
    practitioner_id: args.practitionerId,
    respuesta: args.respuesta as unknown as Record<string, unknown> | null,
    consentimiento_at: args.consentimientoAt,
  })
  if (error) console.error('[REFEPS] Error al registrar verificación:', error.message)
}

// Compara dos columnas nullable con el mismo criterio que el índice único
// profesional_matriculas_unica (COALESCE(col, '')).
function mismaCoalesce(a: string | null, b: string | null): boolean {
  return (a ?? '') === (b ?? '')
}

async function upsertMatriculas(db: DbClient, profesionalId: string, mapeadas: MatriculaMapeada[]) {
  const { data: existentes } = await db
    .from('profesional_matriculas')
    .select('id, tipo, provincia, numero, es_principal')
    .eq('profesional_id', profesionalId)

  let necesitaPrincipal = !(existentes ?? []).some((r) => r.es_principal)
  const nowIso = new Date().toISOString()

  for (const m of mapeadas) {
    const match = (existentes ?? []).find((r) =>
      mismaCoalesce(r.tipo, m.tipo) && mismaCoalesce(r.provincia, m.provincia) && r.numero === m.numero,
    )
    const marcarPrincipal = necesitaPrincipal && m.habilitada

    const campos = {
      tipo: m.tipo,
      provincia: m.provincia,
      jurisdiccion_codigo: m.jurisdiccionCodigo,
      jurisdiccion_nombre: m.jurisdiccionNombre,
      numero: m.numero,
      profesion_codigo: m.profesionCodigo,
      profesion_nombre: m.profesionNombre,
      especialidades: m.especialidades,
      emisor_codigo: m.emisorCodigo,
      emisor_nombre: m.emisorNombre,
      fecha_desde: m.fechaDesde,
      fecha_hasta: m.fechaHasta,
      habilitada: m.habilitada,
      origen: 'refeps',
      verificada: true,
      verificada_at: nowIso,
    }

    if (match) {
      const { error } = await db
        .from('profesional_matriculas')
        .update({ ...campos, ...(marcarPrincipal ? { es_principal: true } : {}) })
        .eq('id', match.id)
      if (error) console.error('[REFEPS] Error al actualizar matrícula:', error.message)
    } else {
      const { error } = await db
        .from('profesional_matriculas')
        .insert({ profesional_id: profesionalId, ...campos, es_principal: marcarPrincipal })
      if (error) console.error('[REFEPS] Error al insertar matrícula:', error.message)
    }

    if (marcarPrincipal) necesitaPrincipal = false
  }
}

function generoAfSexo(gender: FhirPractitioner['gender']): 'M' | 'F' | null {
  if (gender === 'male') return 'M'
  if (gender === 'female') return 'F'
  // 'other'/'unknown'/ausente: no tocar el campo del profesional.
  return null
}

async function actualizarProfile(
  db: DbClient,
  userId: string,
  dniLimpio: string,
  practitioner: FhirPractitioner,
  estadoGlobal: 'habilitada' | 'no_habilitada',
) {
  const { data: profile } = await db
    .from('profiles')
    .select('dni, refeps, sexo, fecha_nacimiento_profesional, nombre, apellido')
    .eq('id', userId)
    .maybeSingle()

  const patch: Record<string, unknown> = {
    // Siempre, independientemente de si había datos previos.
    refeps_estado: estadoGlobal,
    refeps_verificado_at: new Date().toISOString(),
  }

  if (!profile?.dni) patch.dni = dniLimpio
  if (!profile?.refeps) patch.refeps = codigoRefeps(dniLimpio)

  const sexoMapeado = generoAfSexo(practitioner.gender)
  if (!profile?.sexo && sexoMapeado) patch.sexo = sexoMapeado

  if (!profile?.fecha_nacimiento_profesional && practitioner.birthDate) {
    patch.fecha_nacimiento_profesional = practitioner.birthDate
  }

  const nombreBus = practitioner.name?.[0]?.given?.[0]?.trim()
  const apellidoBus = practitioner.name?.[0]?.family?.trim()
  if (!profile?.nombre?.trim() && nombreBus) patch.nombre = nombreBus
  if (!profile?.apellido?.trim() && apellidoBus) patch.apellido = apellidoBus

  const { error } = await db.from('profiles').update(patch).eq('id', userId)
  if (error) console.error('[REFEPS] Error al actualizar profile:', error.message)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: { dni?: string; matricula?: string; consentimiento?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { dni, matricula, consentimiento } = body
  if (!dni || typeof dni !== 'string' || !matricula || typeof matricula !== 'string' || consentimiento !== true) {
    return NextResponse.json({ error: 'Faltan dni, matricula o el consentimiento' }, { status: 400 })
  }

  const dniLimpio = normalizarDni(dni)
  if (!dniLimpio) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  const db = serviceClient()
  const codigo = codigoRefeps(dniLimpio)
  const matriculaTrim = matricula.trim()

  // Límite de intentos — nunca martillar el Bus por reintentos del mismo
  // profesional, y nunca llamarlo si ya se agotó el cupo de esta hora.
  const unaHoraAtras = new Date(Date.now() - UNA_HORA_MS).toISOString()
  const { count } = await db
    .from('refeps_verificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('profesional_id', user.id)
    .gte('consultado_at', unaHoraAtras)
  if ((count ?? 0) >= LIMITE_INTENTOS_POR_HORA) {
    return NextResponse.json({ error: 'Demasiados intentos. Esperá un rato y volvé a intentar.' }, { status: 429 })
  }

  const fechaVerificacion = new Date().toISOString()

  try {
    const resultado = await consultarPractitioner(dniLimpio)

    if (resultado.estado === 'sin_ficha') {
      await registrarVerificacion(db, {
        profesionalId: user.id,
        codigoRefeps: codigo,
        estado: 'sin_ficha',
        httpStatus: resultado.httpStatus,
        practitionerId: null,
        respuesta: null,
        consentimientoAt: null,
      })
      const out: RefepsValidationResponse = { estado: 'sin_ficha', fechaVerificacion, matriculas: [] }
      return NextResponse.json(out, { status: 200 })
    }

    const practitioner = resultado.practitioner
    const mapeadas = mapQualifications(practitioner)
    const coincide = mapeadas.some((m) => m.numero === matriculaTrim)

    if (!coincide) {
      // Nunca devolver nada de la ficha si la matrícula no coincide — evita
      // filtrar datos de un tercero a quien le pegó al DNI equivocado.
      await registrarVerificacion(db, {
        profesionalId: user.id,
        codigoRefeps: codigo,
        estado: 'no_coincide',
        httpStatus: resultado.httpStatus,
        practitionerId: practitioner.id ?? null,
        respuesta: null,
        consentimientoAt: null,
      })
      const out: RefepsValidationResponse = { estado: 'no_coincide', fechaVerificacion, matriculas: [] }
      return NextResponse.json(out, { status: 200 })
    }

    const estadoGlobal: 'habilitada' | 'no_habilitada' = mapeadas.some((m) => m.habilitada) ? 'habilitada' : 'no_habilitada'

    await registrarVerificacion(db, {
      profesionalId: user.id,
      codigoRefeps: codigo,
      estado: estadoGlobal,
      httpStatus: resultado.httpStatus,
      practitionerId: practitioner.id ?? null,
      respuesta: practitioner,
      consentimientoAt: fechaVerificacion,
    })

    await upsertMatriculas(db, user.id, mapeadas)
    await actualizarProfile(db, user.id, dniLimpio, practitioner, estadoGlobal)

    const out: RefepsValidationResponse = {
      estado: estadoGlobal,
      fechaVerificacion,
      matriculas: mapeadas.map((m) => ({
        tipo: m.tipo,
        provincia: m.provincia,
        jurisdiccion: m.jurisdiccionNombre,
        numero: m.numero,
        profesion: m.profesionNombre,
        emisor: m.emisorNombre,
        habilitada: m.habilitada,
      })),
    }
    return NextResponse.json(out, { status: 200 })
  } catch (err) {
    // Un error del Bus (403/500/timeout/red) nunca marca al profesional
    // como no habilitado — queda en "error_servicio" para reintentar.
    const codigoError = err instanceof BusConsultaError ? err.codigo : 'bus_no_disponible'
    const httpStatus = err instanceof BusConsultaError ? err.httpStatus : null
    console.error('[REFEPS] Error al consultar el Bus de Interoperabilidad:', codigoError)

    await registrarVerificacion(db, {
      profesionalId: user.id,
      codigoRefeps: codigo,
      estado: 'error_servicio',
      httpStatus,
      practitionerId: null,
      respuesta: null,
      consentimientoAt: null,
    })

    const out: RefepsValidationResponse = { estado: 'error_servicio', fechaVerificacion, matriculas: [] }
    return NextResponse.json(out, { status: 200 })
  }
}
