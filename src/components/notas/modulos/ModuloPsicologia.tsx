'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { n, dl, hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { Grilla, CampoNum, CampoSegmentado, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
}

const RIESGOS = ['Sin riesgo', 'Bajo', 'Moderado', 'Alto']

function severidadPHQ9(x: number): string {
  return x < 5 ? 'Mínima' : x < 10 ? 'Leve' : x < 15 ? 'Moderada' : x < 20 ? 'Moderadamente severa' : 'Severa'
}
function severidadGAD7(x: number): string {
  return x < 5 ? 'Mínima' : x < 10 ? 'Leve' : x < 15 ? 'Moderada' : 'Severa'
}

export default function ModuloPsicologia({ pacienteId, valores, onChange }: Props) {
  const [closed, setClosed] = useState(false)
  const [ultimo, setUltimo] = useState<{ phq: number | null; gad: number | null; fecha: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('registros_especialidad')
      .select('fecha, datos')
      .eq('paciente_id', pacienteId)
      .eq('especialidad', 'Psicología')
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        const row = (data ?? [])[0] as { fecha: string; datos: Record<string, unknown> } | undefined
        if (!row) { setUltimo(null); return }
        setUltimo({ phq: n(row.datos.phq as string), gad: n(row.datos.gad as string), fecha: row.fecha })
      })
    return () => { cancelado = true }
  }, [pacienteId])

  const v = (k: string) => (valores[k] as string) ?? ''
  const riesgo: string[] = (valores.riesgo as string[]) ?? []

  const calcPhq: ResultadoCalc = (() => {
    const x = n(v('phq'))
    if (x == null) return hint('Completá el puntaje PHQ-9')
    return { val: `${x}`, sub: severidadPHQ9(x) }
  })()

  const calcGad: ResultadoCalc = (() => {
    const x = n(v('gad'))
    if (x == null) return hint('Completá el puntaje GAD-7')
    return { val: `${x}`, sub: severidadGAD7(x) }
  })()

  const calcVsUltima: ResultadoCalc = (() => {
    const a = n(v('phq')); const b = n(v('gad'))
    if (a == null && b == null) return hint('Completá una escala para comparar')
    if (!ultimo) return { val: '–', sub: 'Sin registros previos' }
    const fechaFmt = new Date(ultimo.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    const lineaPhq = a != null && ultimo.phq != null ? dl(a, ultimo.phq, '', true) : '–'
    const lineaGad = b != null && ultimo.gad != null ? dl(b, ultimo.gad, '', true) : '–'
    return { val: `PHQ-9 ${lineaPhq}<br>GAD-7 ${lineaGad}`, sub: `Última: ${ultimo.phq ?? '–'} y ${ultimo.gad ?? '–'} · ${fechaFmt}` }
  })()

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Escalas y riesgo
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <Grilla cols={2}>
            <CampoNum label="PHQ-9" unit="/ 27" value={v('phq')} onChange={(x) => onChange('phq', x)} />
            <CampoNum label="GAD-7" unit="/ 21" value={v('gad')} onChange={(x) => onChange('gad', x)} />
          </Grilla>
          <CampoSegmentado label="Riesgo" opciones={RIESGOS} valor={riesgo} onChange={(x) => onChange('riesgo', x)} />
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="Severidad PHQ-9" resultado={calcPhq} />
        <TarjetaCalc label="Severidad GAD-7" resultado={calcGad} />
        <TarjetaCalc label="Vs. última sesión" resultado={calcVsUltima} />
      </div>
    </div>
  )
}
