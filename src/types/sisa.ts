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

export interface FhirQualification {
  identifier?: FhirIdentifier[]
  code?: FhirCodeableConcept
  period?: FhirPeriod
  extension?: FhirExtension[]
}

export interface FhirPractitioner {
  resourceType: 'Practitioner'
  qualification?: FhirQualification[]
}

export interface FhirBundleEntry {
  resource?: FhirPractitioner
}

export interface FhirBundle {
  resourceType: 'Bundle'
  entry?: FhirBundleEntry[]
}

// Qualification ya mapeada a los campos que usamos — nunca se persiste el
// JSON crudo del Bus, solo esto (Ley 25.326: nada de birthDate/CUIL/nombre).
export interface MatriculaQualification {
  jurisdiccion: string | null
  profesion: string | null
  numero: string | null
  habilitada: boolean
  desde: string | null
}

export type MatriculaEstado = 'habilitada' | 'no_habilitada' | 'sin_ficha' | 'error_servicio'

export interface MatriculaResultado {
  estado: MatriculaEstado
  fechaVerificacion: string
  qualifications: MatriculaQualification[]
  coincideMatricula: boolean | null
}
