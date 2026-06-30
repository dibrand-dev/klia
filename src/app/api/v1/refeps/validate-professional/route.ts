import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SisaApiRawResponse, SisaConsultaRequest, SisaValidationResponse } from '@/types/sisa'

export const runtime = 'nodejs'

const SISA_BASE_URL = 'https://sisa.msal.gov.ar/sisa/services/rest/profesional/obtener'
const SISA_TIMEOUT_MS = 10_000

// TODO: confirmar valor exacto de estado activo con soporte@sisa.msal.gov.ar
// La documentación del WS020 no especifica los valores posibles de `estado`.
const ESTADO_ACTIVO = 'ACTIVO'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth — solo profesionales autenticados pueden consultar
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Credenciales SISA
  const sisaUser = process.env.SISA_USER
  const sisaPassword = process.env.SISA_PASSWORD
  if (!sisaUser || !sisaPassword) {
    console.error('[REFEPS] Variables de entorno SISA_USER o SISA_PASSWORD no configuradas')
    return NextResponse.json(
      { valido: false, error: 'Configuración de SISA incompleta' },
      { status: 500 }
    )
  }

  // Parsear body
  let body: SisaConsultaRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { nrodoc, apellido } = body
  if (!nrodoc || typeof nrodoc !== 'string' || !nrodoc.trim()) {
    return NextResponse.json({ error: 'El campo nrodoc es obligatorio' }, { status: 400 })
  }

  // Construir URL con query params
  const params = new URLSearchParams({
    usuario: sisaUser,
    clave: sisaPassword,
    nrodoc: nrodoc.trim(),
    apellido: apellido?.trim() ?? '',
    nombre: '',
    codigo: '',
  })
  const url = `${SISA_BASE_URL}?${params.toString()}`

  // Fetch con timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SISA_TIMEOUT_MS)

  let raw: SisaApiRawResponse
  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[REFEPS] SISA respondió con status ${response.status}`)
      return NextResponse.json(
        { valido: false, error: 'Servicio SISA no disponible' },
        { status: 502 }
      )
    }

    raw = (await response.json()) as SisaApiRawResponse
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    console.error('[REFEPS] Error al consultar SISA:', isTimeout ? 'timeout' : err)
    return NextResponse.json(
      { valido: false, error: 'Servicio SISA no disponible' },
      { status: 502 }
    )
  }

  // Sin resultado o código de error del servicio
  if (!raw || !raw.nrodoc) {
    const result: SisaValidationResponse = {
      valido: false,
      error: 'Profesional no encontrado en el REFEPS',
      codigoError: raw?.codigo,
    }
    return NextResponse.json(result, { status: 200 })
  }

  // Profesional encontrado — verificar estado activo
  const estadoActivo = raw.estado?.toUpperCase() === ESTADO_ACTIVO
  if (!estadoActivo) {
    const result: SisaValidationResponse = {
      valido: false,
      error: `Matrícula no habilitada (estado: ${raw.estado ?? 'desconocido'})`,
      codigoError: raw.codigo,
    }
    return NextResponse.json(result, { status: 200 })
  }

  // Respuesta exitosa — sanitizar campos antes de enviar al cliente
  const result: SisaValidationResponse = {
    valido: true,
    profesional: {
      apellido: raw.apellido ?? '',
      nombre: raw.nombre ?? '',
      tipoDocumento: raw.tipoDocumento ?? '',
      nrodoc: raw.nrodoc ?? '',
      matricula: raw.matricula ?? '',
      profesion: raw.profesion ?? '',
      jurisdiccion: raw.jurisdiccion ?? '',
      estado: raw.estado ?? '',
      especialidad: raw.especialidad ?? '',
      fechaMatricula: raw.fechaMatricula ?? '',
      fechaModificacion: raw.fechaModificacion ?? '',
      fechaRegistro: raw.fechaRegistro ?? '',
      datosCertificacion: raw.datosCertificacion ?? '',
    },
  }
  return NextResponse.json(result, { status: 200 })
}
