import { createHmac } from 'node:crypto'
import type { FhirBundle, FhirPractitioner } from '@/types/sisa'

// Cliente del Bus de Interoperabilidad — Red Nacional de Salud Digital
// (bus.msal.gob.ar) para consultar el Practitioner de un profesional por su
// código REFEPS. Server-only: nunca importar desde un componente cliente.

const BUS_TIMEOUT_MS = 10_000
// El accessToken vive 180s del lado del Bus — se cachea en memoria con
// margen (150s) para nunca usar uno vencido por el tiempo del round-trip.
const TOKEN_CACHE_MS = 150_000

// Ojo: el system del identifier usa "gov.ar" (no "gob.ar", como las
// extensiones que mapea mapear-qualifications.ts) — son dominios distintos,
// no un typo.
const REFEPS_SYSTEM = 'https://sisa.msal.gov.ar/REFEPS'

export type BusErrorCodigo = 'bus_no_autorizado' | 'bus_error_formato' | 'bus_no_disponible'

export class BusConsultaError extends Error {
  codigo: BusErrorCodigo
  httpStatus: number | null
  constructor(codigo: BusErrorCodigo, httpStatus: number | null = null) {
    super(codigo)
    this.codigo = codigo
    this.httpStatus = httpStatus
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
    if (res.status === 403) throw new BusConsultaError('bus_no_autorizado', res.status)
    if (res.status >= 500) throw new BusConsultaError('bus_error_formato', res.status)
    if (!res.ok) throw new BusConsultaError('bus_no_disponible', res.status)
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

// Código REFEPS = 541 + DNI a 9 dígitos (con ceros a la izquierda). Se
// exporta para que el endpoint persista exactamente el mismo código que se
// usó en la consulta, sin reimplementar la regla.
export function codigoRefeps(dni: string): string {
  return `541${dni.padStart(9, '0')}`
}

export type ConsultaPractitionerResultado =
  | { estado: 'sin_ficha'; httpStatus: number }
  | { estado: 'encontrado'; httpStatus: number; practitioner: FhirPractitioner }

// Nunca loguear el accessToken, el JWT firmado, el secret, ni el body
// completo de una respuesta — como mucho el status code en caso de error.
// Devuelve el Practitioner crudo (sin mapear) — mapear-qualifications.ts
// hace el mapeo de negocio por separado, para poder testearlo sin red.
export async function consultarPractitioner(dni: string): Promise<ConsultaPractitionerResultado> {
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
    return { estado: 'sin_ficha', httpStatus: res.status }
  }
  if (res.status === 403) {
    throw new BusConsultaError('bus_no_autorizado', res.status)
  }
  if (res.status >= 500) {
    throw new BusConsultaError('bus_error_formato', res.status)
  }
  if (!res.ok) {
    throw new BusConsultaError('bus_no_disponible', res.status)
  }

  let bundle: FhirBundle
  try {
    bundle = await res.json()
  } catch {
    throw new BusConsultaError('bus_error_formato', res.status)
  }

  const entry = (bundle.entry ?? []).find((e) => e.resource?.resourceType === 'Practitioner')
  const practitioner = entry?.resource
  if (!practitioner) {
    return { estado: 'sin_ficha', httpStatus: res.status }
  }

  return { estado: 'encontrado', httpStatus: res.status, practitioner }
}
