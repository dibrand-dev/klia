'use client'

// Reporta un fallo de compresión o subida de foto del portal — nunca
// manda la imagen, el comentario, ni ningún id de paciente/registro. La
// telemetría nunca debe romper el flujo de guardado: cualquier falla de
// esta llamada se ignora en silencio.
export function reportarErrorFoto(params: {
  etapa: string
  error: unknown
  file?: { type: string; size: number } | null
  ancho?: number
  alto?: number
}) {
  const { etapa, error, file, ancho, alto } = params
  const nombreError = error instanceof Error ? error.name : typeof error
  const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 200)

  fetch('/api/portal/errores-cliente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      etapa,
      nombreError,
      mensaje,
      userAgent: navigator.userAgent,
      tipoArchivo: file?.type ?? null,
      bytes: file?.size ?? null,
      ancho: ancho ?? null,
      alto: alto ?? null,
    }),
  }).catch(() => {})
}
