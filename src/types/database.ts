export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
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
          id?: string
          email?: string
          nombre?: string
          apellido?: string
          matricula?: string | null
          especialidad?: string | null
          telefono?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
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
          genero: string | null
          nacionalidad: string | null
          estado_civil: string | null
          domicilio: string | null
          ocupacion: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          plan_obra_social: string | null
          numero_autorizacion: string | null
          modalidad_tratamiento: string | null
          frecuencia_sesiones: string | null
          honorarios: number | null
          motivo_consulta: string | null
          codigo_diagnostico: string | null
          gravedad_estimada: string | null
          fecha_inicio_tratamiento: string | null
          created_at: string
          updated_at: string
        }
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
          genero?: string | null
          nacionalidad?: string | null
          estado_civil?: string | null
          domicilio?: string | null
          ocupacion?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          plan_obra_social?: string | null
          numero_autorizacion?: string | null
          modalidad_tratamiento?: string | null
          frecuencia_sesiones?: string | null
          honorarios?: number | null
          motivo_consulta?: string | null
          codigo_diagnostico?: string | null
          gravedad_estimada?: string | null
          fecha_inicio_tratamiento?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
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
          genero?: string | null
          nacionalidad?: string | null
          estado_civil?: string | null
          domicilio?: string | null
          ocupacion?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          plan_obra_social?: string | null
          numero_autorizacion?: string | null
          modalidad_tratamiento?: string | null
          frecuencia_sesiones?: string | null
          honorarios?: number | null
          motivo_consulta?: string | null
          codigo_diagnostico?: string | null
          gravedad_estimada?: string | null
          fecha_inicio_tratamiento?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pacientes_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      turnos: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          fecha_hora: string
          duracion_min: number
          modalidad: 'presencial' | 'videollamada' | 'telefonica'
          estado: 'pendiente' | 'confirmado' | 'cancelado' | 'realizado' | 'no_asistio'
          monto: number | null
          notas: string | null
          pagado: boolean
          motivo_cancelacion: string | null
          recordatorio_enviado: boolean
          serie_recurrente_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          fecha_hora: string
          duracion_min?: number
          modalidad?: 'presencial' | 'videollamada' | 'telefonica'
          estado?: 'pendiente' | 'confirmado' | 'cancelado' | 'realizado' | 'no_asistio'
          monto?: number | null
          notas?: string | null
          pagado?: boolean
          motivo_cancelacion?: string | null
          recordatorio_enviado?: boolean
          serie_recurrente_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          fecha_hora?: string
          duracion_min?: number
          modalidad?: 'presencial' | 'videollamada' | 'telefonica'
          estado?: 'pendiente' | 'confirmado' | 'cancelado' | 'realizado' | 'no_asistio'
          monto?: number | null
          notas?: string | null
          pagado?: boolean
          motivo_cancelacion?: string | null
          recordatorio_enviado?: boolean
          serie_recurrente_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'turnos_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'turnos_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notas_clinicas: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          turno_id: string | null
          fecha: string
          contenido: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          turno_id?: string | null
          fecha: string
          contenido: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          turno_id?: string | null
          fecha?: string
          contenido?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notas_clinicas_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_clinicas_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_clinicas_turno_id_fkey'
            columns: ['turno_id']
            isOneToOne: false
            referencedRelation: 'turnos'
            referencedColumns: ['id']
          },
        ]
      }
      objetivos_terapeuticos: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          descripcion: string
          logrado: boolean
          created_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          descripcion: string
          logrado?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          descripcion?: string
          logrado?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'objetivos_terapeuticos_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
        ]
      }
      medicacion_paciente: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          farmaco: string
          dosis: string | null
          frecuencia: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          farmaco: string
          dosis?: string | null
          frecuencia?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          farmaco?: string
          dosis?: string | null
          frecuencia?: string | null
          activo?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'medicacion_paciente_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
        ]
      }
      admin_users: {
        Row: {
          id: string
          email: string
          nombre: string
          apellido: string
          rol: 'total' | 'administrativo'
          activo: boolean
          created_at: string
          last_sign_in: string | null
        }
        Insert: {
          id?: string
          email: string
          nombre: string
          apellido: string
          rol: 'total' | 'administrativo'
          activo?: boolean
          created_at?: string
          last_sign_in?: string | null
        }
        Update: {
          id?: string
          email?: string
          nombre?: string
          apellido?: string
          rol?: 'total' | 'administrativo'
          activo?: boolean
          created_at?: string
          last_sign_in?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          valor: string
          descripcion: string | null
          updated_at: string
        }
        Insert: {
          clave: string
          valor: string
          descripcion?: string | null
          updated_at?: string
        }
        Update: {
          clave?: string
          valor?: string
          descripcion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      planes: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          precio_mensual: number
          es_publico: boolean
          es_ilimitado: boolean
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          precio_mensual?: number
          es_publico?: boolean
          es_ilimitado?: boolean
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          precio_mensual?: number
          es_publico?: boolean
          es_ilimitado?: boolean
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      plan_funcionalidades: {
        Row: {
          plan_id: string
          funcionalidad: string
        }
        Insert: {
          plan_id: string
          funcionalidad: string
        }
        Update: {
          plan_id?: string
          funcionalidad?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_funcionalidades_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'planes'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_interconsultas: {
        Args: { p_paciente_id: string }
        Returns: Interconsulta[]
      }
      admin_get_profiles: {
        Args: { p_search?: string | null }
        Returns: ProfileWithLastSignIn[]
      }
      admin_get_last_sign_in: {
        Args: { p_id: string }
        Returns: string | null
      }
    }
    Enums: {
      estado_turno: 'cancelado' | 'confirmado' | 'no_asistio' | 'pendiente' | 'realizado'
      modalidad_turno: 'presencial' | 'telefonica' | 'videollamada'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Paciente = Database['public']['Tables']['pacientes']['Row']
export type TurnoRow = Database['public']['Tables']['turnos']['Row']
export type EstadoTurno = Database['public']['Enums']['estado_turno']
export type ModalidadTurno = Database['public']['Enums']['modalidad_turno']
export type NotaClinica = Database['public']['Tables']['notas_clinicas']['Row']
export type ObjetivoTerapeutico = Database['public']['Tables']['objetivos_terapeuticos']['Row']
export type MedicacionPaciente = Database['public']['Tables']['medicacion_paciente']['Row']
export type AdminUser = Database['public']['Tables']['admin_users']['Row']
export type Configuracion = Database['public']['Tables']['configuracion']['Row']
export type Plan = Database['public']['Tables']['planes']['Row']
export type PlanFuncionalidad = Database['public']['Tables']['plan_funcionalidades']['Row']

export type PlanConFuncionalidades = Plan & {
  plan_funcionalidades: { funcionalidad: string }[]
}

export interface Turno extends TurnoRow {
  paciente?: Paciente
}

export type Interconsulta = {
  nombre: string
  apellido: string
  especialidad: string | null
  telefono: string | null
  email: string | null
}

export type ProfileWithLastSignIn = {
  id: string
  nombre: string
  apellido: string
  email: string
  especialidad: string | null
  created_at: string
  last_sign_in_at: string | null
}
