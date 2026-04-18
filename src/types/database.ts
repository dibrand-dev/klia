export type EstadoTurno = 'pendiente' | 'confirmado' | 'cancelado' | 'realizado' | 'no_asistio'
export type ModalidadTurno = 'presencial' | 'videollamada' | 'telefonica'

export interface Profile {
  id: string
  email: string
  nombre: string
  apellido: string
  matricula: string | null
  especialidad: string | null
  telefono: string | null
  created_at: string
  updated_at: string
}

export interface Paciente {
  id: string
  terapeuta_id: string
  nombre: string
  apellido: string
  dni: string | null
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  obra_social: string | null
  numero_afiliado: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

// Solo columnas de la tabla (sin joins)
export interface TurnoRow {
  id: string
  terapeuta_id: string
  paciente_id: string
  fecha_hora: string
  duracion_min: number
  modalidad: ModalidadTurno
  estado: EstadoTurno
  monto: number | null
  notas: string | null
  created_at: string
  updated_at: string
}

// Con el join de paciente (para uso en componentes)
export interface Turno extends TurnoRow {
  paciente?: Paciente
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          email: string
          nombre: string
          apellido: string
          matricula?: string | null
          especialidad?: string | null
          telefono?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          nombre?: string
          apellido?: string
          matricula?: string | null
          especialidad?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: Paciente
        Insert: {
          id?: string
          terapeuta_id: string
          nombre: string
          apellido: string
          dni?: string | null
          fecha_nacimiento?: string | null
          telefono?: string | null
          email?: string | null
          obra_social?: string | null
          numero_afiliado?: string | null
          notas?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          nombre?: string
          apellido?: string
          dni?: string | null
          fecha_nacimiento?: string | null
          telefono?: string | null
          email?: string | null
          obra_social?: string | null
          numero_afiliado?: string | null
          notas?: string | null
          activo?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      turnos: {
        Row: TurnoRow
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          fecha_hora: string
          duracion_min?: number
          modalidad?: ModalidadTurno
          estado?: EstadoTurno
          monto?: number | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          paciente_id?: string
          fecha_hora?: string
          duracion_min?: number
          modalidad?: ModalidadTurno
          estado?: EstadoTurno
          monto?: number | null
          notas?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      estado_turno: EstadoTurno
      modalidad_turno: ModalidadTurno
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
