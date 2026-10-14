import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Paciente } from '@/types/database'

const PAGE_SIZE = 1000

// PostgREST devuelve como máximo 1000 filas por default (sin PGRST_DB_MAX_ROWS
// configurado distinto) — con más de 1000 pacientes, el listado se trunca en
// silencio y los últimos por apellido desaparecen de todo lo que dependa de
// este fetch (buscador de Nuevo turno, listado de Pacientes, etc). Pagina en
// bloques de 1000 hasta que una página devuelve menos de 1000 filas.
export async function fetchAllPacientes(
  supabase: SupabaseClient<Database>,
  terapeutaId: string,
  { soloActivos = true, select = '*' }: { soloActivos?: boolean; select?: string } = {},
): Promise<Paciente[]> {
  const pacientes: Paciente[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('pacientes')
      .select(select)
      .eq('terapeuta_id', terapeutaId)

    if (soloActivos) query = query.eq('activo', true)

    // .order('id') como desempate: .order('apellido') solo no garantiza un
    // orden estable entre páginas cuando hay apellidos repetidos.
    const { data, error } = await query
      .order('apellido')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    pacientes.push(...((data ?? []) as unknown as Paciente[]))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return pacientes
}
