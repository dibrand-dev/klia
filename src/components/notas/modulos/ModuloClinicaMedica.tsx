'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularIMC, clasificarIMC } from '@/lib/nutricion/calculos'
import { n, dl, hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { Grilla, CampoNum, Colapsable, CampoCie10, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
}

function clasificarTA(s: number, d: number): string {
  if (s >= 140 || d >= 90) return 'HTA estadio 2'
  if (s >= 130 || d >= 80) return 'HTA estadio 1'
  if (s >= 120) return 'Elevada'
  return 'Normal'
}

export default function ModuloClinicaMedica({ pacienteId, valores, onChange }: Props) {
  const [closed, setClosed] = useState(false)
  const [pesoOpen, setPesoOpen] = useState(false)
  const [ultimo, setUltimo] = useState<{ tas: number | null; tad: number | null; fecha: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('registros_especialidad')
      .select('fecha, datos')
      .eq('paciente_id', pacienteId)
      .eq('especialidad', 'Clínica Médica')
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        const row = (data ?? [])[0] as { fecha: string; datos: Record<string, unknown> } | undefined
        if (!row) { setUltimo(null); return }
        setUltimo({ tas: n(row.datos.tas as string), tad: n(row.datos.tad as string), fecha: row.fecha })
      })
    return () => { cancelado = true }
  }, [pacienteId])

  const v = (k: string) => (valores[k] as string) ?? ''
  const cie: string[] = (valores.cie_cm as string[]) ?? []

  const calcTA: ResultadoCalc = (() => {
    const s = n(v('tas')); const d = n(v('tad'))
    if (!s || !d) return hint('Completá sistólica y diastólica')
    const c = clasificarTA(s, d)
    return { val: `${s}/${d} <small>mmHg</small>`, sub: c === 'Normal' ? c : `<span class="al">${c}</span>`, warn: c !== 'Normal' }
  })()

  const calcImc: ResultadoCalc = (() => {
    const p = n(v('peso')); const a = n(v('alt'))
    if (!p || !a) return hint('Completá peso y altura')
    const imc = calcularIMC(p, a)
    if (imc == null) return hint('Completá peso y altura')
    return { val: imc.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }), sub: clasificarIMC(imc).label }
  })()

  const calcVsUltima: ResultadoCalc = (() => {
    const s = n(v('tas'))
    if (!s) return hint('Completá la TA para comparar')
    if (!ultimo || ultimo.tas == null) return { val: '–', sub: 'Sin registros previos' }
    const fechaFmt = new Date(ultimo.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    return { val: `TAS ${dl(s, ultimo.tas, '', true)}`, sub: `Última: ${ultimo.tas}/${ultimo.tad ?? '–'} · ${fechaFmt}` }
  })()

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Signos vitales
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <Grilla cols={3}>
            <CampoNum label="TA sistólica" unit="mmHg" value={v('tas')} onChange={(x) => onChange('tas', x)} />
            <CampoNum label="TA diastólica" unit="mmHg" value={v('tad')} onChange={(x) => onChange('tad', x)} />
            <CampoNum label="FC" unit="lpm" value={v('fc')} onChange={(x) => onChange('fc', x)} />
            <CampoNum label="FR" unit="rpm" value={v('fr')} onChange={(x) => onChange('fr', x)} />
            <CampoNum label="Temp." unit="°C" value={v('temp')} onChange={(x) => onChange('temp', x)} />
            <CampoNum label="SatO₂" unit="%" value={v('sat')} onChange={(x) => onChange('sat', x)} />
          </Grilla>
          <Colapsable titulo="Peso y altura" open={pesoOpen} onToggle={() => setPesoOpen((o) => !o)}>
            <Grilla cols={3}>
              <CampoNum label="Peso" unit="kg" value={v('peso')} onChange={(x) => onChange('peso', x)} />
              <CampoNum label="Altura" unit="cm" value={v('alt')} onChange={(x) => onChange('alt', x)} />
            </Grilla>
          </Colapsable>
          <CampoCie10 chips={cie} onChange={(x) => onChange('cie_cm', x)} />
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="Tensión arterial" resultado={calcTA} />
        <TarjetaCalc label="IMC" resultado={calcImc} />
        <TarjetaCalc label="Vs. última consulta" resultado={calcVsUltima} />
      </div>
    </div>
  )
}
