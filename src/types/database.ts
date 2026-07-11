export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          nombre: string
          apellido: string
          dni: string | null
          matricula: string | null
          matricula_tipo: string | null
          matricula_provincia: string | null
          especialidad: string | null
          telefono: string | null
          domicilio: string | null
          direccion: string | null
          provincia: string | null
          localidad: string | null
          pais: string | null
          firma_url: string | null
          firma_sello_url: string | null
          avatar_url: string | null
          sexo: string | null
          fecha_nacimiento_profesional: string | null
          domicilio_consultorio: string | null
          localidad_consultorio: string | null
          provincia_consultorio: string | null
          codigo_descuento_id: string | null
          codigo_aplicado_fecha: string | null
          plan: 'esencial' | 'profesional' | 'premium' | 'bonificado'
          estado_cuenta: 'trial' | 'activa' | 'bloqueada' | 'cancelada'
          trial_inicio: string
          trial_fin: string
          suscripcion_inicio: string | null
          suscripcion_fin: string | null
          mp_subscription_id: string | null
          plan_elegido_registro: string | null
          agenda_hora_inicio: number // numeric(4,2) en DB — soporta cuartos de hora (8.25, 8.5, 8.75)
          agenda_hora_fin: number   // numeric(4,2) en DB — soporta cuartos de hora
          cobrar_inasistencias: boolean
          email_bloqueada_enviado: boolean
          booking_slug: string | null
          booking_bio: string | null
          booking_duracion_sesion: number
          booking_duracion_entrevista: number
          booking_tiempo_entre: number
          booking_anticipacion_minutos: number
          booking_modalidades: string[]
          booking_precio_sesion: number | null
          booking_precio_entrevista: number | null
          booking_moneda: string
          booking_activo: boolean
          booking_requiere_pago: boolean
          feriados_nacionales: boolean
          feriados_provinciales: boolean
          feriados_trabajar_si_confirmado: boolean
          terminologia: 'sesion' | 'consulta' | null
          horarios_por_dia: Record<string, { activo: boolean; inicio: number; fin: number }> | null
          onboarding_completed: boolean
          onboarding_skipped: boolean
          aviso_deuda_activo: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          nombre: string
          apellido: string
          dni?: string | null
          matricula?: string | null
          matricula_tipo?: string | null
          matricula_provincia?: string | null
          especialidad?: string | null
          telefono?: string | null
          direccion?: string | null
          provincia?: string | null
          localidad?: string | null
          pais?: string | null
          avatar_url?: string | null
          sexo?: string | null
          fecha_nacimiento_profesional?: string | null
          domicilio_consultorio?: string | null
          localidad_consultorio?: string | null
          provincia_consultorio?: string | null
          codigo_descuento_id?: string | null
          codigo_aplicado_fecha?: string | null
          plan?: 'esencial' | 'profesional' | 'premium' | 'bonificado'
          estado_cuenta?: 'trial' | 'activa' | 'bloqueada' | 'cancelada'
          trial_inicio?: string
          trial_fin?: string
          suscripcion_inicio?: string | null
          suscripcion_fin?: string | null
          mp_subscription_id?: string | null
          plan_elegido_registro?: string | null
          agenda_hora_inicio?: number
          agenda_hora_fin?: number
          cobrar_inasistencias?: boolean
          email_bloqueada_enviado?: boolean
          booking_slug?: string | null
          booking_bio?: string | null
          booking_duracion_sesion?: number
          booking_duracion_entrevista?: number
          booking_tiempo_entre?: number
          booking_anticipacion_minutos?: number
          booking_modalidades?: string[]
          booking_precio_sesion?: number | null
          booking_precio_entrevista?: number | null
          booking_moneda?: string
          booking_activo?: boolean
          booking_requiere_pago?: boolean
          feriados_nacionales?: boolean
          feriados_provinciales?: boolean
          feriados_trabajar_si_confirmado?: boolean
          terminologia?: 'sesion' | 'consulta' | null
          horarios_por_dia?: Record<string, { activo: boolean; inicio: number; fin: number }> | null
          onboarding_completed?: boolean
          onboarding_skipped?: boolean
          aviso_deuda_activo?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          nombre?: string
          apellido?: string
          dni?: string | null
          matricula?: string | null
          matricula_tipo?: string | null
          matricula_provincia?: string | null
          especialidad?: string | null
          telefono?: string | null
          direccion?: string | null
          provincia?: string | null
          localidad?: string | null
          pais?: string | null
          avatar_url?: string | null
          sexo?: string | null
          fecha_nacimiento_profesional?: string | null
          domicilio_consultorio?: string | null
          localidad_consultorio?: string | null
          provincia_consultorio?: string | null
          codigo_descuento_id?: string | null
          codigo_aplicado_fecha?: string | null
          plan?: 'esencial' | 'profesional' | 'premium' | 'bonificado'
          estado_cuenta?: 'trial' | 'activa' | 'bloqueada' | 'cancelada'
          trial_inicio?: string
          trial_fin?: string
          suscripcion_inicio?: string | null
          suscripcion_fin?: string | null
          mp_subscription_id?: string | null
          plan_elegido_registro?: string | null
          agenda_hora_inicio?: number
          agenda_hora_fin?: number
          cobrar_inasistencias?: boolean
          email_bloqueada_enviado?: boolean
          booking_slug?: string | null
          booking_bio?: string | null
          booking_duracion_sesion?: number
          booking_duracion_entrevista?: number
          booking_tiempo_entre?: number
          booking_anticipacion_minutos?: number
          booking_modalidades?: string[]
          booking_precio_sesion?: number | null
          booking_precio_entrevista?: number | null
          booking_moneda?: string
          booking_activo?: boolean
          booking_requiere_pago?: boolean
          feriados_nacionales?: boolean
          feriados_provinciales?: boolean
          feriados_trabajar_si_confirmado?: boolean
          terminologia?: 'sesion' | 'consulta' | null
          horarios_por_dia?: Record<string, { activo: boolean; inicio: number; fin: number }> | null
          onboarding_completed?: boolean
          onboarding_skipped?: boolean
          aviso_deuda_activo?: boolean | null
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
          os_nombre_libre: string | null
          os_plan_libre: string | null
          os_pendiente_validacion: boolean
          os_config_id: string | null
          autorizacion_vigencia_desde: string | null
          autorizacion_vigencia_hasta: string | null
          firma_paciente_url: string | null
          moneda_preferida: string
          cobrar_inasistencias: boolean | null
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
          os_nombre_libre?: string | null
          os_plan_libre?: string | null
          os_pendiente_validacion?: boolean
          os_config_id?: string | null
          autorizacion_vigencia_desde?: string | null
          autorizacion_vigencia_hasta?: string | null
          moneda_preferida?: string
          cobrar_inasistencias?: boolean | null
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
          os_nombre_libre?: string | null
          os_plan_libre?: string | null
          os_pendiente_validacion?: boolean
          os_config_id?: string | null
          autorizacion_vigencia_desde?: string | null
          autorizacion_vigencia_hasta?: string | null
          moneda_preferida?: string
          cobrar_inasistencias?: boolean | null
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
          moneda: string
          notas: string | null
          pagado: boolean
          motivo_cancelacion: string | null
          recordatorio_enviado: boolean
          serie_recurrente_id: string | null
          google_event_id: string | null
          meet_link: string | null
          ai_summary: string | null
          estado_atencion: 'en_espera' | 'en_consultorio' | 'atendido' | 'ausente' | null
          estado_pago: 'pendiente' | 'pagado' | 'pago_parcial' | 'bonificado' | null
          monto_pagado: number | null
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
          moneda?: string
          notas?: string | null
          pagado?: boolean
          motivo_cancelacion?: string | null
          recordatorio_enviado?: boolean
          serie_recurrente_id?: string | null
          google_event_id?: string | null
          meet_link?: string | null
          ai_summary?: string | null
          estado_atencion?: 'en_espera' | 'en_consultorio' | 'atendido' | 'ausente' | null
          estado_pago?: 'pendiente' | 'pagado' | 'pago_parcial' | 'bonificado' | null
          monto_pagado?: number | null
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
          moneda?: string
          notas?: string | null
          ai_summary?: string | null
          estado_atencion?: 'en_espera' | 'en_consultorio' | 'atendido' | 'ausente' | null
          estado_pago?: 'pendiente' | 'pagado' | 'pago_parcial' | 'bonificado' | null
          monto_pagado?: number | null
          pagado?: boolean
          motivo_cancelacion?: string | null
          recordatorio_enviado?: boolean
          serie_recurrente_id?: string | null
          google_event_id?: string | null
          meet_link?: string | null
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
      cobros: {
        Row: {
          id: string
          turno_id: string | null
          terapeuta_id: string
          paciente_id: string
          monto_cobrado: number
          moneda: string
          medio_pago: 'efectivo' | 'transferencia' | 'mercado_pago' | null
          fecha_cobro: string
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          turno_id?: string | null
          terapeuta_id: string
          paciente_id: string
          monto_cobrado: number
          moneda?: string
          medio_pago?: 'efectivo' | 'transferencia' | 'mercado_pago' | null
          fecha_cobro?: string
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          monto_cobrado?: number
          moneda?: string
          medio_pago?: 'efectivo' | 'transferencia' | 'mercado_pago'
          fecha_cobro?: string
          notas?: string | null
        }
        Relationships: []
      }
      notas_clinicas: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          turno_id: string | null
          fecha: string
          contenido: string
          borrador: boolean
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
          borrador?: boolean
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
          borrador?: boolean
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
          prescriptor: string | null
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
          prescriptor?: string | null
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
          prescriptor?: string | null
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
      turnos_recurrentes: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          dia_semana: number
          hora: string
          duracion_min: number
          modalidad: string
          monto: number | null
          fecha_inicio: string
          fecha_fin: string
          activo: boolean
          frecuencia: 'semanal' | 'quincenal' | 'mensual'
          semana_del_mes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          dia_semana: number
          hora: string
          duracion_min?: number
          modalidad?: string
          monto?: number | null
          fecha_inicio: string
          fecha_fin: string
          activo?: boolean
          frecuencia?: 'semanal' | 'quincenal' | 'mensual'
          semana_del_mes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          dia_semana?: number
          hora?: string
          duracion_min?: number
          modalidad?: string
          monto?: number | null
          fecha_inicio?: string
          fecha_fin?: string
          activo?: boolean
          frecuencia?: 'semanal' | 'quincenal' | 'mensual'
          semana_del_mes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      obras_sociales: {
        Row: {
          id: string
          nombre: string
          plan: string | null
          validada: boolean
          veces_ingresada: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          plan?: string | null
          validada?: boolean
          veces_ingresada?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          plan?: string | null
          validada?: boolean
          veces_ingresada?: number
          updated_at?: string
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
          slug: string | null
          nombre: string
          descripcion: string | null
          precio_mensual: number
          precio_anual_mensual: number | null
          es_publico: boolean
          es_ilimitado: boolean
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug?: string | null
          nombre: string
          descripcion?: string | null
          precio_mensual?: number
          precio_anual_mensual?: number | null
          es_publico?: boolean
          es_ilimitado?: boolean
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string | null
          nombre?: string
          descripcion?: string | null
          precio_mensual?: number
          precio_anual_mensual?: number | null
          es_publico?: boolean
          es_ilimitado?: boolean
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      registros_antropometricos: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          turno_id: string | null
          fecha: string
          peso: number | null
          altura: number | null
          cintura: number | null
          cadera: number | null
          pliegue_tricipital: number | null
          pliegue_subescapular: number | null
          pliegue_suprailiaco: number | null
          perimetro_brazo: number | null
          perimetro_pierna: number | null
          porcentaje_grasa: number | null
          porcentaje_musculo: number | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          turno_id?: string | null
          fecha: string
          peso?: number | null
          altura?: number | null
          cintura?: number | null
          cadera?: number | null
          pliegue_tricipital?: number | null
          pliegue_subescapular?: number | null
          pliegue_suprailiaco?: number | null
          perimetro_brazo?: number | null
          perimetro_pierna?: number | null
          porcentaje_grasa?: number | null
          porcentaje_musculo?: number | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          paciente_id?: string
          turno_id?: string | null
          fecha?: string
          peso?: number | null
          altura?: number | null
          cintura?: number | null
          cadera?: number | null
          pliegue_tricipital?: number | null
          pliegue_subescapular?: number | null
          pliegue_suprailiaco?: number | null
          perimetro_brazo?: number | null
          perimetro_pierna?: number | null
          porcentaje_grasa?: number | null
          porcentaje_musculo?: number | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'registros_antropometricos_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
        ]
      }
      colegios: {
        Row: {
          id: string
          nombre: string
          contacto_nombre: string | null
          contacto_email: string | null
          fecha_acuerdo: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          contacto_nombre?: string | null
          contacto_email?: string | null
          fecha_acuerdo?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          contacto_nombre?: string | null
          contacto_email?: string | null
          fecha_acuerdo?: string | null
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      codigos_descuento: {
        Row: {
          id: string
          colegio_id: string
          codigo: string
          porcentaje_descuento: number
          activo: boolean
          usos_maximos: number | null
          usos_actuales: number
          created_at: string
        }
        Insert: {
          id?: string
          colegio_id: string
          codigo: string
          porcentaje_descuento: number
          activo?: boolean
          usos_maximos?: number | null
          usos_actuales?: number
          created_at?: string
        }
        Update: {
          id?: string
          colegio_id?: string
          codigo?: string
          porcentaje_descuento?: number
          activo?: boolean
          usos_maximos?: number | null
          usos_actuales?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'codigos_descuento_colegio_id_fkey'
            columns: ['colegio_id']
            isOneToOne: false
            referencedRelation: 'colegios'
            referencedColumns: ['id']
          },
        ]
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
      planilla_templates: {
        Row: {
          id: string
          nombre_os: string
          slug: string
          requiere_firma_olografa: boolean
          aviso_firma: string | null
          config: Record<string, unknown>
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre_os: string
          slug: string
          requiere_firma_olografa?: boolean
          aviso_firma?: string | null
          config: Record<string, unknown>
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          nombre_os?: string
          slug?: string
          requiere_firma_olografa?: boolean
          aviso_firma?: string | null
          config?: Record<string, unknown>
          activa?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profesional_obras_sociales: {
        Row: {
          id: string
          terapeuta_id: string
          nombre: string
          cuit_os: string | null
          razon_social: string | null
          domicilio_os: string | null
          condicion_iva_os: string
          condicion_venta: string
          codigo_practica: string | null
          descripcion_practica: string | null
          honorario_por_sesion: number | null
          activa: boolean
          planilla_template_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          nombre: string
          cuit_os?: string | null
          razon_social?: string | null
          domicilio_os?: string | null
          condicion_iva_os?: string
          condicion_venta?: string
          codigo_practica?: string | null
          descripcion_practica?: string | null
          honorario_por_sesion?: number | null
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          terapeuta_id?: string
          nombre?: string
          cuit_os?: string | null
          razon_social?: string | null
          domicilio_os?: string | null
          condicion_iva_os?: string
          condicion_venta?: string
          codigo_practica?: string | null
          descripcion_practica?: string | null
          honorario_por_sesion?: number | null
          activa?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      os_honorarios_historial: {
        Row: {
          id: string
          os_config_id: string
          honorario: number
          vigente_desde: string
          vigente_hasta: string | null
          created_at: string
        }
        Insert: {
          id?: string
          os_config_id: string
          honorario: number
          vigente_desde?: string
          vigente_hasta?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          os_config_id?: string
          honorario?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      liquidaciones: {
        Row: {
          id: string
          terapeuta_id: string
          os_config_id: string
          periodo_mes: number
          periodo_anio: number
          estado: 'borrador' | 'generada' | 'presentada' | 'cobrada'
          total_sesiones: number
          total_importe: number
          excel_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          os_config_id: string
          periodo_mes: number
          periodo_anio: number
          estado?: 'borrador' | 'generada' | 'presentada' | 'cobrada'
          total_sesiones?: number
          total_importe?: number
          excel_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          estado?: 'borrador' | 'generada' | 'presentada' | 'cobrada'
          total_sesiones?: number
          total_importe?: number
          excel_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      liquidacion_items: {
        Row: {
          id: string
          liquidacion_id: string
          paciente_id: string
          numero_afiliado: string | null
          numero_autorizacion: string | null
          cantidad_sesiones: number
          honorario_unitario: number
          importe_total: number
          fecha_liquidacion: string
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id?: string
          liquidacion_id: string
          paciente_id: string
          numero_afiliado?: string | null
          numero_autorizacion?: string | null
          cantidad_sesiones: number
          honorario_unitario: number
          importe_total: number
          fecha_liquidacion: string
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cantidad_sesiones?: number
          honorario_unitario?: number
          importe_total?: number
          observaciones?: string | null
        }
        Relationships: []
      }
      entrevistas: {
        Row: {
          id: string
          terapeuta_id: string
          nombre: string
          apellido: string
          telefono: string | null
          email: string | null
          fecha: string
          hora: string
          duracion: number
          costo: number | null
          moneda: string
          notas: string | null
          estado: 'pendiente' | 'realizada' | 'cancelada' | 'convertida'
          paciente_id: string | null
          google_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          nombre: string
          apellido: string
          telefono?: string | null
          email?: string | null
          fecha: string
          hora: string
          duracion?: number
          costo?: number | null
          moneda?: string
          notas?: string | null
          estado?: 'pendiente' | 'realizada' | 'cancelada' | 'convertida'
          paciente_id?: string | null
          google_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          nombre?: string
          apellido?: string
          telefono?: string | null
          email?: string | null
          fecha?: string
          hora?: string
          duracion?: number
          costo?: number | null
          moneda?: string
          notas?: string | null
          estado?: 'pendiente' | 'realizada' | 'cancelada' | 'convertida'
          paciente_id?: string | null
          google_event_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      archivos_paciente: {
        Row: {
          id: string
          paciente_id: string
          terapeuta_id: string
          nombre: string
          categoria: 'laboratorio' | 'imagenes' | 'documentos' | 'otros'
          google_drive_file_id: string
          google_drive_url: string
          mime_type: string
          tamanio_bytes: number
          fecha_estudio: string | null
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          paciente_id: string
          terapeuta_id: string
          nombre: string
          categoria: 'laboratorio' | 'imagenes' | 'documentos' | 'otros'
          google_drive_file_id: string
          google_drive_url: string
          mime_type: string
          tamanio_bytes: number
          fecha_estudio?: string | null
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          nombre?: string
          categoria?: 'laboratorio' | 'imagenes' | 'documentos' | 'otros'
          fecha_estudio?: string | null
          descripcion?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          id: string
          terapeuta_id: string
          access_token: string
          refresh_token: string
          token_expiry: string
          calendar_id?: string
          sync_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          refresh_token?: string
          token_expiry?: string
          calendar_id?: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      informes_medicos: {
        Row: {
          id: string
          terapeuta_id: string
          paciente_id: string
          tipo_solicitud: string
          diagnostico_cie10_codigo: string | null
          diagnostico_cie10_descripcion: string | null
          periodo_desde: string
          periodo_hasta: string
          observaciones_profesional: string | null
          contenido_generado: string
          estado: string
          pdf_drive_url: string | null
          pdf_drive_file_id: string | null
          created_at: string
          firmado_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          paciente_id: string
          tipo_solicitud: string
          diagnostico_cie10_codigo?: string | null
          diagnostico_cie10_descripcion?: string | null
          periodo_desde: string
          periodo_hasta: string
          observaciones_profesional?: string | null
          contenido_generado: string
          estado?: string
          pdf_drive_url?: string | null
          pdf_drive_file_id?: string | null
          created_at?: string
          firmado_at?: string | null
          updated_at?: string
        }
        Update: {
          tipo_solicitud?: string
          diagnostico_cie10_codigo?: string | null
          diagnostico_cie10_descripcion?: string | null
          periodo_desde?: string
          periodo_hasta?: string
          observaciones_profesional?: string | null
          contenido_generado?: string
          estado?: string
          pdf_drive_url?: string | null
          pdf_drive_file_id?: string | null
          firmado_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suscripciones: {
        Row: {
          id: string
          terapeuta_id: string
          plan: 'esencial' | 'profesional' | 'premium'
          modalidad: 'mensual' | 'anual'
          mp_preapproval_id: string | null
          mp_preapproval_plan_id: string | null
          estado: 'pending' | 'authorized' | 'paused' | 'cancelled'
          monto: number
          suscripcion_inicio: string | null
          suscripcion_fin: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          terapeuta_id: string
          plan: 'esencial' | 'profesional' | 'premium'
          modalidad: 'mensual' | 'anual'
          mp_preapproval_id?: string | null
          mp_preapproval_plan_id?: string | null
          estado?: 'pending' | 'authorized' | 'paused' | 'cancelled'
          monto: number
          suscripcion_inicio?: string | null
          suscripcion_fin?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          estado?: 'pending' | 'authorized' | 'paused' | 'cancelled'
          mp_preapproval_id?: string | null
          suscripcion_inicio?: string | null
          suscripcion_fin?: string | null
          updated_at?: string
        }
        Relationships: []
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
      admin_validar_pacientes_obra_social: {
        Args: { p_nombre_original: string; p_nombre_final: string }
        Returns: void
      }
      aplicar_codigo_descuento: {
        Args: { p_profile_id: string; p_codigo: string }
        Returns:
          | { success: true; porcentaje_descuento: number }
          | { success: false; error: 'codigo_invalido' | 'usos_agotados' | 'ya_tiene_codigo' }
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
export type TurnoRecurrente = Database['public']['Tables']['turnos_recurrentes']['Row']
export type ObraSocial = Database['public']['Tables']['obras_sociales']['Row']
export type Plan = Database['public']['Tables']['planes']['Row']
export type RegistroAntropometrico = Database['public']['Tables']['registros_antropometricos']['Row']
export type Colegio = Database['public']['Tables']['colegios']['Row']
export type CodigoDescuento = Database['public']['Tables']['codigos_descuento']['Row']
export type ModuloConfig = {
  modulo_id: string
  nombre: string
  descripcion: string | null
  icono: string
  ruta: string
  planes: string[]
  activo: boolean
}
export type PlanFuncionalidad = Database['public']['Tables']['plan_funcionalidades']['Row']
export type PlanFeature = {
  id: string
  plan_id: string
  texto: string
  incluido: boolean
  orden: number
  activo: boolean
}
export type ProfesionalObraSocial = Database['public']['Tables']['profesional_obras_sociales']['Row']
export type OsHonorariosHistorial = Database['public']['Tables']['os_honorarios_historial']['Row']
export type Liquidacion = Database['public']['Tables']['liquidaciones']['Row']
export type LiquidacionItem = Database['public']['Tables']['liquidacion_items']['Row']
export type GoogleCalendarToken = Database['public']['Tables']['google_calendar_tokens']['Row']
export type Entrevista = Database['public']['Tables']['entrevistas']['Row']
export type ArchivoPaciente = Database['public']['Tables']['archivos_paciente']['Row']
export type InformeMedico = Database['public']['Tables']['informes_medicos']['Row']

export type PlanConFuncionalidades = Plan & {
  plan_funcionalidades: { funcionalidad: string }[]
}

export type Cobro = Database['public']['Tables']['cobros']['Row']
export type EstadoPago = 'pendiente' | 'pagado' | 'pago_parcial' | 'bonificado'

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
  email_confirmed_at: string | null
  plan: 'esencial' | 'profesional' | 'premium' | 'bonificado'
  estado_cuenta: 'trial' | 'activa' | 'bloqueada' | 'cancelada'
  trial_fin: string
  suscripcion_fin: string | null
}
