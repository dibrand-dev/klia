import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PacienteColaboradorRow } from '@/types/database'

export async function resolverNombresPacientesColaborador(
  supabase: SupabaseClient<Database>,
  esColaborador: boolean
): Promise<Map<string, { nombre: string; apellido: string }>> {
  if (!esColaborador) return new Map()

  const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
  const todosPacientes = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]

  return new Map(
    todosPacientes.map((p) => [p.id, { nombre: p.nombre, apellido: p.apellido }])
  )
}
