import { iniciales } from './iniciales'

// Mismo formato que src/app/portal/(guarded)/layout.tsx para el nombre del
// profesional en el header del portal — nunca con título ("Lic.", etc.).
export function formatNombreProfesional(nombre: string | null, apellido: string | null): string {
  return [nombre, apellido].filter(Boolean).join(' ') || 'Tu profesional'
}

export interface ComentarioProfesionalRow {
  comentario_profesional: string | null
  comentario_profesional_at: string | null
  comentario_profesional_editado_at: string | null
  comentario_visto_at: string | null
}

export interface ComentarioProfesionalOut {
  texto: string
  at: string
  editado: boolean
  autorNombre: string
  autorIniciales: string
  nuevo: boolean
}

// "Nuevo" para el paciente: hay comentario y (nunca se vio, o se vio antes
// de la última escritura — creación o edición, lo que sea más reciente).
export function comentarioProfesionalEsNuevo(row: ComentarioProfesionalRow): boolean {
  if (!row.comentario_profesional) return false
  const referencia = row.comentario_profesional_editado_at ?? row.comentario_profesional_at
  if (!referencia) return false
  if (!row.comentario_visto_at) return true
  return new Date(row.comentario_visto_at).getTime() < new Date(referencia).getTime()
}

export function armarComentarioProfesional(row: ComentarioProfesionalRow, autorNombre: string): ComentarioProfesionalOut | null {
  if (!row.comentario_profesional) return null
  const at = row.comentario_profesional_editado_at ?? row.comentario_profesional_at ?? new Date().toISOString()
  return {
    texto: row.comentario_profesional,
    at,
    editado: !!row.comentario_profesional_editado_at,
    autorNombre,
    autorIniciales: iniciales(autorNombre),
    nuevo: comentarioProfesionalEsNuevo(row),
  }
}
