'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { n, dl, hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { Grilla, CampoNum, CampoSelect, CampoEva, Colapsable, BarraProgreso, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
}

const ZONAS = ['Rodilla', 'Hombro', 'Columna lumbar', 'Columna cervical', 'Tobillo', 'Cadera', 'Muñeca']
const LADOS = ['Derecho', 'Izquierdo', 'Bilateral']
const MOVIMIENTOS = ['Flexión', 'Extensión', 'Abducción', 'Aducción', 'Rotación interna', 'Rotación externa']
const DANIELS = ['0', '1', '2', '3', '4', '5']

export default function ModuloKinesiologia({ pacienteId, valores, onChange }: Props) {
  const [closed, setClosed] = useState(false)
  const [romOpen, setRomOpen] = useState(true)
  const [ultimo, setUltimo] = useState<{ eva: number | null; rom: number | null; mov: string | null } | null>(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('registros_especialidad')
      .select('datos')
      .eq('paciente_id', pacienteId)
      .eq('especialidad', 'Kinesiología')
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        const row = (data ?? [])[0] as { datos: Record<string, unknown> } | undefined
        if (!row) { setUltimo(null); return }
        const d = row.datos
        setUltimo({ eva: n(d.eva as string), rom: n(d.rom as string), mov: (d.mov as string) ?? null })
      })
    return () => { cancelado = true }
  }, [pacienteId])

  const v = (k: string) => (valores[k] as string) ?? ''

  const calcDolor: ResultadoCalc = (() => {
    const e = n(v('eva'))
    if (e == null) return hint('Marcá el dolor en la escala')
    if (!ultimo || ultimo.eva == null) return { val: `${e}/10`, sub: 'Sin registros previos' }
    return { val: `${e}/10 ${dl(e, ultimo.eva, '', true)}`, sub: `Última: ${ultimo.eva}/10` }
  })()

  const calcRom: ResultadoCalc = (() => {
    const r = n(v('rom'))
    if (r == null) return hint('Completá el ROM para comparar')
    if (!ultimo || ultimo.rom == null) return { val: `${r}°`, sub: v('mov') || 'Flexión' }
    return { val: `${r}° ${dl(r, ultimo.rom, '°')}`, sub: `${v('mov') || 'Flexión'} · última: ${ultimo.rom}°` }
  })()

  const sesionActual = n(v('ses'))
  const sesionesTotal = n(v('sest'))
  const hayPlan = !!sesionActual && !!sesionesTotal

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Evaluación kinésica
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <CampoEva label="Dolor (EVA)" valor={v('eva')} onChange={(x) => onChange('eva', x)} />
          <Grilla cols={2}>
            <CampoSelect label="Zona tratada" opciones={ZONAS} valor={v('zona')} onChange={(x) => onChange('zona', x)} />
            <CampoSelect label="Lado" opciones={LADOS} valor={v('lado')} onChange={(x) => onChange('lado', x)} />
          </Grilla>
          <Colapsable titulo="Rango de movimiento y fuerza" open={romOpen} onToggle={() => setRomOpen((o) => !o)}>
            <Grilla cols={3}>
              <CampoSelect label="Movimiento" opciones={MOVIMIENTOS} valor={v('mov')} onChange={(x) => onChange('mov', x)} />
              <CampoNum label="ROM" unit="°" value={v('rom')} onChange={(x) => onChange('rom', x)} />
              <CampoSelect label="Fuerza (Daniels)" opciones={DANIELS} valor={v('daniels')} onChange={(x) => onChange('daniels', x)} />
            </Grilla>
          </Colapsable>
          <Grilla cols={2}>
            <CampoNum label="Sesión N.º" value={v('ses')} onChange={(x) => onChange('ses', x)} />
            <CampoNum label="de" unit="sesiones" value={v('sest')} onChange={(x) => onChange('sest', x)} />
          </Grilla>
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="Dolor vs. última sesión" resultado={calcDolor} />
        <TarjetaCalc label="ROM vs. última sesión" resultado={calcRom} />
        <div className="cc">
          <span className="cl">Plan de tratamiento</span>
          {!hayPlan ? (
            <span className="ch2">Completá la sesión actual y el total</span>
          ) : (
            <>
              <span className="cv">{sesionActual} de {sesionesTotal}</span>
              <BarraProgreso pct={Math.min(sesionActual! / sesionesTotal!, 1) * 100} />
              <span className="cs">Quedan {Math.max(sesionesTotal! - sesionActual!, 0)} sesiones</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
