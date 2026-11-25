// Tipos mínimos para la respuesta FHIR del Practitioner vía Bus de
// Interoperabilidad — Red Nacional de Salud Digital (bus.msal.gob.ar).
// Reemplaza la integración anterior con SISA WS020 (REFEPS).

export interface FhirCoding {
  system?: string
  code?: string
  display?: string
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[]
  text?: string
}

export interface FhirExtension {
  url: string
  valueBoolean?: boolean
  valueString?: string
  valueCoding?: FhirCoding
}

export interface FhirIdentifier {
  system?: string
  value?: string
}

export interface FhirPeriod {
  start?: string
  end?: string
}

export interface FhirIssuer {
  identifier?: { value?: string }
  display?: string
}

export interface FhirQualification {
  identifier?: FhirIdentifier[]
  code?: FhirCodeableConcept
  period?: FhirPeriod
  extension?: FhirExtension[]
  issuer?: FhirIssuer
}

export interface FhirHumanName {
  family?: string
  given?: string[]
}

export interface FhirPractitioner {
  resourceType: 'Practitioner'
  id?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
  name?: FhirHumanName[]
  qualification?: FhirQualification[]
}

export interface FhirBundleEntry {
  resource?: FhirPractitioner
}

export interface FhirBundle {
  resourceType: 'Bundle'
  entry?: FhirBundleEntry[]
}

// Una qualification del Bus ya mapeada a los campos que persistimos en
// profesional_matriculas — tipo/provincia ya resueltos (nacional vs.
// provincial según el emisor), nunca el JSON crudo de la extension.
export interface MatriculaMapeada {
  tipo: 'nacional' | 'provincial'
  provincia: string | null
  jurisdiccionCodigo: string | null
  jurisdiccionNombre: string | null
  numero: string
  profesionCodigo: string | null
  profesionNombre: string | null
  especialidades: string[] | null
  emisorCodigo: string | null
  emisorNombre: string | null
  fechaDesde: string | null
  fechaHasta: string | null
  habilitada: boolean
}

export type RefepsEstado = 'habilitada' | 'no_habilitada' | 'sin_ficha' | 'no_coincide' | 'error_servicio'

// Forma sanitizada que devuelve /api/v1/refeps/validate-professional al
// cliente — nunca fecha de nacimiento, CUIL, ni el JSON crudo del Bus.
export interface RefepsValidationMatricula {
  tipo: 'nacional' | 'provincial'
  provincia: string | null
  jurisdiccion: string | null
  numero: string
  profesion: string | null
  emisor: string | null
  habilitada: boolean
}

export interface RefepsValidationResponse {
  estado: RefepsEstado
  fechaVerificacion: string
  matriculas: RefepsValidationMatricula[]
}
