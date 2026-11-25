import { createHmac } from 'node:crypto'
import type { FhirBundle, FhirPractitioner, FhirQualification, MatriculaQualification } from '@/types/sisa'

// Cliente del Bus de Interoperabilidad — Red Nacional de Salud Digital
// (bus.msal.gob.ar) para consultar el Practitioner de un profesional por su
// código REFEPS. Server-only: nunca importar desde un componente cliente.

const BUS_TIMEOUT_MS = 10_000
// El accessToken vive 180s del lado del Bus — se cachea en memoria con
// margen (150s) para nunca usar uno vencido por el tiempo del round-trip.
const TOKEN_CACHE_MS = 150_000

const EXT_HABILITADA = 'http://fhir.msal.gob.ar/StructureDefinition/MatriculaHabilitada'
const EXT_JURISDICCION = 'http://fhir.msal.gob.ar/StructureDefinition/JurisdMatricula'
// Ojo: el system del identifier usa "gov.ar" (no "gob.ar", como las
// extensiones de arriba) — son dominios distintos, no un typo.
const REFEPS_SYSTEM = 'https://sisa.msal.gov.ar/REFEPS'

export type BusErrorCodigo = 'bus_no_autorizado' | 'bus_error_formato' | 'bus_no_disponible'

export class BusConsultaError extends Error {
  codigo: BusErrorCodigo
  constructor(codigo: BusErrorCodigo) {
    super(codigo)
    this.codigo = codigo
  }
}

function getBusConfig(): { baseUrl: string; issuer: string; secret: string } {
  const baseUrl = process.env.BUS_BASE_URL
  const issuer = process.env.BUS_ISSUER
  const secret = process.env.BUS_TOKEN_SECRET
  if (!baseUrl || !issuer || !secret) {
    // Nunca indicar cuál variable específica falta.
    throw new Error('Configuración del Bus de Interoperabilidad incompleta')
  }
  return { baseUrl, issuer, secret }
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function firmarJwtHS256(payload: Record<string, unknown>, secret: string): string {
  const headerB64 = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`
  const signature = createHmac('sha256', secret).update(signingInput).digest()
  return `${signingInput}.${base64url(signature)}`
}

let tokenCache: { accessToken: string; obtenidoEn: number } | null = null

async function obtenerAccessToken(): Promise<string> {
  const ahora = Date.now()
  if (tokenCache && ahora - tokenCache.obtenidoEn < TOKEN_CACHE_MS) {
    return tokenCache.accessToken
  }

  const { baseUrl, issuer, secret } = getBusConfig()
  const iat = Math.floor(ahora / 1000)
  const jwt = firmarJwtHS256({
    iss: issuer,
    iat,
    exp: iat + 3600,
    aud: 'aud',
    sub: 'sub',
    name: 'name',
    ident: 'ident',
    role: 'role',
  }, secret)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BUS_TIMEOUT_MS)

  let data: { accessToken?: string } | null = null
  try {
    const res = await fetch(`${baseUrl}/bus-auth/v2/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grantType: 'client_credentials',
        scope: 'Practitioner/*.read',
        clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        clientAssertion: jwt,
      }),
      signal: controller.signal,
    })
    if (res.status === 403) throw new BusConsultaError('bus_no_autorizado')
    if (res.status >= 500) throw new BusConsultaError('bus_error_formato')
    if (!res.ok) throw new BusConsultaError('bus_no_disponible')
    data = await res.json()
  } catch (err) {
    if (err instanceof BusConsultaError) throw err
    throw new BusConsultaError('bus_no_disponible')
  } finally {
    clearTimeout(timeoutId)
  }

  if (!data?.accessToken) {
    throw new BusConsultaError('bus_error_formato')
  }

  tokenCache = { accessToken: data.accessToken, obtenidoEn: ahora }
  return data.accessToken
}

function codigoRefeps(dni: string): string {
  return `541${dni.padStart(9, '0')}`
}

function mapearQualifications(practitioner: FhirPractitioner): MatriculaQualification[] {
  return (practitioner.qualification ?? []).map((q: FhirQualification) => {
    const extHabilitada = q.extension?.find((e) => e.url === EXT_HABILITADA)
    const extJurisdiccion = q.extension?.find((e) => e.url === EXT_JURISDICCION)
    return {
      habilitada: extHabilitada?.valueBoolean === true,
      jurisdiccion: extJurisdiccion?.valueCoding?.display ?? null,
      numero: q.identifier?.[0]?.value ?? null,
      profesion: q.code?.coding?.[0]?.display ?? null,
      desde: q.period?.start ?? null,
    }
  })
}

export type PractitionerResultado =
  | { estado: 'habilitada' | 'no_habilitada'; qualifications: MatriculaQualification[] }
  | { estado: 'sin_ficha' }

// Nunca loguear el accessToken, el JWT firmado, el secret, ni el body
// completo de una respuesta — como mucho el status code en caso de error.
export async function consultarPractitioner(dni: string): Promise<PractitionerResultado> {
  const { baseUrl } = getBusConfig()
  const accessToken = await obtenerAccessToken()

  const identifierValue = `${REFEPS_SYSTEM}|${codigoRefeps(dni)}`
  const url = `${baseUrl}/fhir/Practitioner?identifier=${encodeURIComponent(identifierValue)}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BUS_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timeoutId)
    throw new BusConsultaError('bus_no_disponible')
  }
  clearTimeout(timeoutId)

  // 404 = OperationOutcome "no se encuentra" — el profesional simplemente no
  // tiene ficha en el REFEPS, nunca se trata como fraude ni como error.
  if (res.status === 404) {
    return { estado: 'sin_ficha' }
  }
  if (res.status === 403) {
    throw new BusConsultaError('bus_no_autorizado')
  }
  if (res.status >= 500) {
    throw new BusConsultaError('bus_error_formato')
  }
  if (!res.ok) {
    throw new BusConsultaError('bus_no_disponible')
  }

  let bundle: FhirBundle
  try {
    bundle = await res.json()
  } catch {
    throw new BusConsultaError('bus_error_formato')
  }

  const entry = (bundle.entry ?? []).find((e) => e.resource?.resourceType === 'Practitioner')
  const practitioner = entry?.resource
  if (!practitioner) {
    return { estado: 'sin_ficha' }
  }

  const qualifications = mapearQualifications(practitioner)
  const habilitada = qualifications.some((q) => q.habilitada)
  return { estado: habilitada ? 'habilitada' : 'no_habilitada', qualifications }
}
