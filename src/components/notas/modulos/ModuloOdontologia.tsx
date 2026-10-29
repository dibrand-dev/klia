'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { CampoSegmentado, CampoSelect, CampoCie10, Odontograma, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
}

const CARAS = ['M', 'O', 'D', 'V', 'L/P']
const PRESTACIONES = ['Obturación', 'Endodoncia', 'Exodoncia', 'Limpieza / tartrectomía', 'Sellador', 'Corona', 'Control']

type HistorialPieza = Record<string, { prestacion: string; fecha: string }>

export default function ModuloOdontologia({ pacienteId, valores, onChange }: Props) {
  const [closed, setClosed] = useState(false)
  const [historial, setHistorial] = useState<HistorialPieza>({})

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('registros_especialidad')
      .select('fecha, datos')
      .eq('paciente_id', pacienteId)
      .eq('especialidad', 'Odontología')
      .order('fecha', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelado) return
        const h: HistorialPieza = {}
        for (const row of (data ?? []) as { fecha: string; datos: Record<string, unknown> }[]) {
          const piezas = (row.datos.piezas as string[]) ?? []
          const prestacion = (row.datos.prestacion as string) ?? ''
          for (const p of piezas) {
            if (!h[p]) h[p] = { prestacion, fecha: row.fecha }
          }
        }
        setHistorial(h)
      })
    return () => { cancelado = true }
  }, [pacienteId])

  const piezas: string[] = (valores.piezas as string[]) ?? []
  const caras: string[] = (valores.caras as string[]) ?? []
  const cie: string[] = (valores.cie_od as string[]) ?? []
  const prestacion = (valores.prest as string) ?? ''

  const calcHoy: ResultadoCalc = piezas.length === 0
    ? hint('Elegí las piezas tratadas')
    : { val: piezas.join(', '), sub: `${prestacion || 'Sin prestación'}${caras.length ? ' · ' + caras.join(' ') : ''}` }

  const calcHistorial: ResultadoCalc = (() => {
    if (piezas.length === 0) return hint('Elegí una pieza para ver su historial')
    const filas = piezas
      .filter((p) => historial[p])
      .map((p) => {
        const h = historial[p]
        const mm = new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' })
        return `<b>${p}</b> ${h.prestacion} · ${mm}`
      })
    if (filas.length === 0) return hint('Sin intervenciones previas en estas piezas')
    return { val: '', sub: filas.join('<br>') }
  })()

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Prestación odontológica
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <Odontograma piezas={piezas} onChange={(x) => onChange('piezas', x)} />
          <CampoSegmentado label="Caras" opciones={CARAS} valor={caras} onChange={(x) => onChange('caras', x)} multi />
          <CampoSelect label="Prestación" opciones={PRESTACIONES} valor={prestacion} onChange={(x) => onChange('prest', x)} />
          <CampoCie10 chips={cie} onChange={(x) => onChange('cie_od', x)} />
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="Hoy" resultado={calcHoy} />
        <TarjetaCalc label="Historial de la pieza" resultado={calcHistorial} />
      </div>
    </div>
  )
}
