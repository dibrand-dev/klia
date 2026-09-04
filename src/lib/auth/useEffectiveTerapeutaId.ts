'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TerapeutaEfectivo } from './getEffectiveTerapeutaId'

interface EstadoTerapeutaEfectivo {
  terapeutaId: string | null
  esColaborador: boolean
  veCobros: boolean
  loading: boolean
}

// Mismo comportamiento que getEffectiveTerapeutaIdServer, para componentes cliente.
export function useEffectiveTerapeutaId(): EstadoTerapeutaEfectivo {
  const [estado, setEstado] = useState<TerapeutaEfectivo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function resolver() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelado) { setEstado(null); setLoading(false) }
        return
      }

      const { data: colaboracion } = await supabase
        .from('colaboradores')
        .select('profesional_id, ve_cobros')
        .eq('colaborador_id', user.id)
        .eq('activo', true)
        .eq('invitacion_aceptada', true)
        .maybeSingle()

      if (cancelado) return

      setEstado(
        colaboracion
          ? { terapeutaId: colaboracion.profesional_id, esColaborador: true, veCobros: colaboracion.ve_cobros }
          : { terapeutaId: user.id, esColaborador: false, veCobros: true }
      )
      setLoading(false)
    }

    resolver()
    return () => { cancelado = true }
  }, [])

  return {
    terapeutaId: estado?.terapeutaId ?? null,
    esColaborador: estado?.esColaborador ?? false,
    veCobros: estado?.veCobros ?? true,
    loading,
  }
}
