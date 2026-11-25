import type { FhirPractitioner, MatriculaMapeada } from '@/types/sisa'

// Función pura — sin red, sin Supabase — para poder testearla con un
// Practitioner fijo (fixture). Mapea cada qualification del Bus a los
// campos que persistimos en profesional_matriculas.

const EXT_HABILITADA = 'http://fhir.msal.gob.ar/StructureDefinition/MatriculaHabilitada'
const EXT_JURISDICCION = 'http://fhir.msal.gob.ar/StructureDefinition/JurisdMatricula'
const EXT_ESPECIALIDAD = 'http://fhir.msal.gob.ar/StructureDefinition/especialidadMatricula'

// Identifier del Ministerio de Salud de la Nación como emisor — cualquier
// otro emisor es un colegio/consejo provincial.
export const CODIGO_MINISTERIO_NACION = '10002001110000'

export function mapQualifications(practitioner: FhirPractitioner): MatriculaMapeada[] {
  return (practitioner.qualification ?? [])
    .map((q): MatriculaMapeada | null => {
      const numero = q.identifier?.[0]?.value?.trim()
      if (!numero) return null

      const extHabilitada = q.extension?.find((e) => e.url === EXT_HABILITADA)
      const extJurisdiccion = q.extension?.find((e) => e.url === EXT_JURISDICCION)
      const especialidades = (q.extension ?? [])
        .filter((e) => e.url === EXT_ESPECIALIDAD)
        .map((e) => e.valueString ?? e.valueCoding?.display ?? null)
        .filter((v): v is string => !!v)

      const emisorCodigo = q.issuer?.identifier?.value ?? null
      const emisorNombre = q.issuer?.display ?? null
      const esNacional = emisorCodigo === CODIGO_MINISTERIO_NACION
      const jurisdiccionNombre = extJurisdiccion?.valueCoding?.display ?? null
      const jurisdiccionCodigo = extJurisdiccion?.valueCoding?.code ?? null

      return {
        // Provincia solo aplica a matrículas provinciales — una nacional
        // nunca la lleva, aunque la extensión de jurisdicción esté presente.
        tipo: esNacional ? 'nacional' : 'provincial',
        provincia: esNacional ? null : jurisdiccionNombre,
        jurisdiccionCodigo,
        jurisdiccionNombre,
        numero,
        profesionCodigo: q.code?.coding?.[0]?.code ?? null,
        profesionNombre: q.code?.coding?.[0]?.display ?? null,
        especialidades: especialidades.length > 0 ? especialidades : null,
        emisorCodigo,
        emisorNombre,
        fechaDesde: q.period?.start ?? null,
        fechaHasta: q.period?.end ?? null,
        habilitada: extHabilitada?.valueBoolean === true,
      }
    })
    .filter((q): q is MatriculaMapeada => q !== null)
}
