// Tipos para integración con SISA WS020 (REFEPS)
// Documentación: https://sisa.msal.gov.ar/sisa/services/rest/profesional/obtener

export interface SisaConsultaRequest {
  nrodoc: string
  apellido?: string
}

// Respuesta cruda del WS020 — todos los campos son opcionales salvo lo indicado
export interface SisaApiRawResponse {
  apellido?: string
  nombre?: string
  tipoDocumento?: string
  nrodoc?: string       // confirmado como presente en respuesta exitosa
  codigo?: string       // código de estado de la respuesta del servicio
  matricula?: string
  profesion?: string
  jurisdiccion?: string
  estado?: string       // valor de estado activo — ver TODO en route handler
  especialidad?: string
  fechaMatricula?: string
  fechaModificacion?: string
  fechaRegistro?: string
  datosCertificacion?: string
}

// Respuesta sanitizada que devuelve nuestro endpoint al frontend
export interface SisaValidationResponse {
  valido: boolean
  profesional?: {
    apellido: string
    nombre: string
    tipoDocumento: string
    nrodoc: string
    matricula: string
    profesion: string
    jurisdiccion: string
    estado: string
    especialidad: string
    fechaMatricula: string
    fechaModificacion: string
    fechaRegistro: string
    datosCertificacion: string
  }
  error?: string
  codigoError?: string
}
