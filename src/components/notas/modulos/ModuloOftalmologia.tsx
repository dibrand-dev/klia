'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularPIOCorregida } from '@/lib/oftalmologia/calculos'
import { n, f1, dl, hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { Grilla, CampoNum, Colapsable, CampoTexto, CampoCie10, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
}

function equivalenteEsferico(v: (k: string) => string): ResultadoCalc {
  const partes = (['od', 'oi'] as const).map((o) => {
    const esf = n(v(`esf_${o}`))
    if (esf == null) return null
    const cil = n(v(`cil_${o}`)) ?? 0
    const q = Math.round((esf + cil / 2) * 4) / 4
    const signo = q > 0 ? '+' : q < 0 ? '−' : ''
    const abs = Math.abs(q).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${o.toUpperCase()} ${signo}${abs} D`
  })
  const validas = partes.filter((p): p is string => !!p)
  if (validas.length === 0) return hint('Completá la refracción')
  return { val: validas.join('<br>'), sub: 'Esfera + cilindro / 2' }
}

function presionIntraocular(v: (k: string) => string): ResultadoCalc {
  const ojos = (['od', 'oi'] as const).map((o) => {
    const m = n(v(`pio_${o}`))
    const p = n(v(`paq_${o}`))
    const c = m != null && p != null ? calcularPIOCorregida(m, p) : null
    return { o: o.toUpperCase(), m, p, c }
  })
  if (ojos.every((e) => e.m == null)) return hint('Completá la PIO de cada ojo')
  const ef = (e: typeof ojos[0]) => e.c ?? e.m ?? 0
  const alertas: string[] = []
  ojos.forEach((e) => { if (e.m != null && ef(e) > 21) alertas.push(`${e.o} elevada`) })
  if (ojos[0].m != null && ojos[1].m != null && Math.abs(ef(ojos[0]) - ef(ojos[1])) >= 5) alertas.push('Asimetría ≥ 5 mmHg')
  const status = alertas.length ? `<span class="al">${alertas.join(' · ')}</span>` : 'Dentro de rango (≤ 21)'

  if (ojos.every((e) => e.c == null)) {
    return {
      val: `${ojos[0].m ?? '–'} / ${ojos[1].m ?? '–'} <small>mmHg</small>`,
      sub: `${status}<br>Sin paquimetría: valores sin corregir`,
      warn: alertas.length > 0,
    }
  }
  const filas = ojos.map((e) => {
    if (e.m == null) return `<b>${e.o}</b><span class="pm">–</span><i></i><span></span>`
    if (e.c == null) return `<b>${e.o}</b><span class="pm">${e.m}</span><i></i><span class="pn">sin paquim.</span>`
    return `<b>${e.o}</b><span class="pm">${e.m}</span><i>→</i><span class="pk ${e.c > 21 ? 'al' : ''}">${f1(e.c)}</span>`
  }).join('')
  return { val: `<span class="pio">${filas}</span>`, sub: `Medida → corregida (Ehlers) · mmHg<br>${status}`, warn: alertas.length > 0 }
}

export default function ModuloOftalmologia({ pacienteId, valores, onChange }: Props) {
  const [closed, setClosed] = useState(false)
  const [rxOpen, setRxOpen] = useState(true)
  const [bioOpen, setBioOpen] = useState(false)
  const [ultimo, setUltimo] = useState<{ pioOd: number | null; pioOi: number | null; avOdCc: string | null } | null>(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    Promise.all([
      supabase.from('registros_pio').select('pio_medida_od, pio_medida_oi').eq('paciente_id', pacienteId).order('fecha', { ascending: false }).limit(1),
      supabase.from('registros_refraccion').select('av_od').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(1),
    ]).then(([pio, rx]) => {
      if (cancelado) return
      const pioRow = (pio.data ?? [])[0] as { pio_medida_od: number | null; pio_medida_oi: number | null } | undefined
      const rxRow = (rx.data ?? [])[0] as { av_od: string | null } | undefined
      if (!pioRow && !rxRow) { setUltimo(null); return }
      setUltimo({ pioOd: pioRow?.pio_medida_od ?? null, pioOi: pioRow?.pio_medida_oi ?? null, avOdCc: rxRow?.av_od ?? null })
    })
    return () => { cancelado = true }
  }, [pacienteId])

  const v = (k: string) => (valores[k] as string) ?? ''
  const cie: string[] = (valores.cie_of as string[]) ?? []

  const calcVsUltima: ResultadoCalc = (() => {
    const a = n(v('pio_od')); const b = n(v('pio_oi'))
    if (a == null && b == null && !v('av_od_cc')) return hint('Completá AV o PIO para comparar')
    if (!ultimo) return { val: '–', sub: 'Sin registros previos' }
    const lineaOd = a != null && ultimo.pioOd != null ? dl(a, ultimo.pioOd, '', true) : '–'
    const lineaOi = b != null && ultimo.pioOi != null ? dl(b, ultimo.pioOi, '', true) : '–'
    return {
      val: `PIO OD ${lineaOd}<br>PIO OI ${lineaOi}`,
      sub: `AV cc OD: ${ultimo.avOdCc ?? '–'} → ${v('av_od_cc') || '–'}`,
    }
  })()

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Examen oftalmológico
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <div className="eyes">
            <span /><span className="eh">sc</span><span className="eh">cc</span><span className="eh">PIO</span>
            <b>OD</b>
            <span className="in"><input placeholder="20/" value={v('av_od_sc')} onChange={(e) => onChange('av_od_sc', e.target.value)} /></span>
            <span className="in"><input placeholder="20/" value={v('av_od_cc')} onChange={(e) => onChange('av_od_cc', e.target.value)} /></span>
            <span className="in"><input inputMode="decimal" placeholder="0" value={v('pio_od')} onChange={(e) => onChange('pio_od', e.target.value)} /><em>mmHg</em></span>
            <b>OI</b>
            <span className="in"><input placeholder="20/" value={v('av_oi_sc')} onChange={(e) => onChange('av_oi_sc', e.target.value)} /></span>
            <span className="in"><input placeholder="20/" value={v('av_oi_cc')} onChange={(e) => onChange('av_oi_cc', e.target.value)} /></span>
            <span className="in"><input inputMode="decimal" placeholder="0" value={v('pio_oi')} onChange={(e) => onChange('pio_oi', e.target.value)} /><em>mmHg</em></span>
          </div>
          <p className="cap">Agudeza visual (Snellen) sin y con corrección · Presión intraocular</p>
          <Grilla cols={2}>
            <CampoNum label="Paquimetría OD" unit="µm" value={v('paq_od')} onChange={(x) => onChange('paq_od', x)} />
            <CampoNum label="Paquimetría OI" unit="µm" value={v('paq_oi')} onChange={(x) => onChange('paq_oi', x)} />
          </Grilla>
          <Colapsable titulo="Refracción" open={rxOpen} onToggle={() => setRxOpen((o) => !o)}>
            <div className="rx">
              <span /><span className="eh">Esfera</span><span className="eh">Cilindro</span><span className="eh">Eje</span><span className="eh">Adición</span>
              {(['od', 'oi'] as const).map((o) => (
                <Fragment key={o}>
                  <b>{o.toUpperCase()}</b>
                  {(['esf', 'cil', 'eje', 'add'] as const).map((c) => (
                    <span className="in" key={`${c}-${o}`}>
                      <input inputMode="decimal" placeholder={c === 'eje' ? '0°' : '0,00'} value={v(`${c}_${o}`)} onChange={(e) => onChange(`${c}_${o}`, e.target.value)} />
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </Colapsable>
          <Colapsable titulo="Biomicroscopía y fondo de ojo" open={bioOpen} onToggle={() => setBioOpen((o) => !o)}>
            <CampoTexto label="Biomicroscopía" value={v('bio')} onChange={(x) => onChange('bio', x)} placeholder="Párpados, conjuntiva, córnea, cámara anterior, cristalino…" />
            <CampoTexto label="Fondo de ojo" value={v('fo')} onChange={(x) => onChange('fo', x)} placeholder="Papila, mácula, vasos, periferia…" />
          </Colapsable>
          <CampoCie10 chips={cie} onChange={(x) => onChange('cie_of', x)} />
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="Equivalente esférico" resultado={equivalenteEsferico(v)} />
        <TarjetaCalc label="Presión intraocular" resultado={presionIntraocular(v)} />
        <TarjetaCalc label="Vs. última consulta" resultado={calcVsUltima} />
      </div>
    </div>
  )
}
