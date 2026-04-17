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

export interface Turno {
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
  paciente?: Paciente
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      pacientes: {
        Row: Paciente
        Insert: Omit<Paciente, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Paciente, 'id' | 'terapeuta_id' | 'created_at' | 'updated_at'>>
      }
      turnos: {
        Row: Turno
        Insert: Omit<Turno, 'id' | 'created_at' | 'updated_at' | 'paciente'>
        Update: Partial<Omit<Turno, 'id' | 'terapeuta_id' | 'created_at' | 'updated_at' | 'paciente'>>
      }
    }
    Enums: {
      estado_turno: EstadoTurno
      modalidad_turno: ModalidadTurno
    }
  }
}
