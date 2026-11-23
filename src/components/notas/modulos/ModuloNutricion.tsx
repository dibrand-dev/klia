'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { calcularIMC, clasificarIMC, calcularGEB, type FormulaGEB } from '@/lib/nutricion/calculos'
import { clasificarPediatrico, type ResultadoPediatrico } from '@/lib/nutricion/pediatria'
import { n, f0, f1, dl, hint, type ResultadoCalc } from '@/lib/notas/calc-utils'
import { Grilla, CampoNum, Colapsable, TarjetaCalc } from '@/components/notas/campos'
import type { ValoresModulo } from '@/lib/notas/modulos'

// Mismas etiquetas que clasificarIMC() de adulto — no se inventan textos nuevos.
const IMC_PEDIATRICO_LABEL: Record<ResultadoPediatrico['imcCategoria'], string> = {
  bajo_peso: 'Bajo peso',
  adecuado: 'Normal',
  sobrepeso: 'Sobrepeso',
  obesidad: 'Obesidad',
}

interface Props {
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string) => void
  edadPaciente: number | null
  sexoPaciente: 'M' | 'F' | null
  fechaNacimientoPaciente?: string | null
  fechaNota?: string
}

export default function ModuloNutricion({ pacienteId, valores, onChange, edadPaciente, sexoPaciente, fechaNacimientoPaciente, fechaNota }: Props) {
  const [closed, setClosed] = useState(false)
  const [pliegOpen, setPliegOpen] = useState(false)
  const [formula, setFormula] = useState<FormulaGEB>('mifflin')
  const [ultimoPeso, setUltimoPeso] = useState<{ peso: number; fecha: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('registros_antropometricos')
      .select('peso, fecha')
      .eq('paciente_id', pacienteId)
      .not('peso', 'is', null)
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        const row = (data ?? [])[0] as { peso: number; fecha: string } | undefined
        setUltimoPeso(row ? { peso: row.peso, fecha: row.fecha } : null)
      })
    return () => { cancelado = true }
  }, [pacienteId])

  const v = (k: string) => (valores[k] as string) ?? ''
  const pesoVal = n(v('peso'))
  const alturaVal = n(v('alt'))
  const esMenor = edadPaciente != null && edadPaciente < 18

  // Clasificación pediátrica (OMS) — solo se dispara (y solo ahí se carga la
  // tabla LMS, vía import() dinámico dentro de clasificarPediatrico) cuando
  // ya sabemos por edadPaciente que es menor de 18; nunca para adultos.
  const [pediatrico, setPediatrico] = useState<ResultadoPediatrico | null>(null)
  useEffect(() => {
    let cancelado = false
    if (!esMenor || !fechaNacimientoPaciente || !sexoPaciente || !pesoVal || !alturaVal) {
      setPediatrico(null)
      return
    }
    clasificarPediatrico({
      sexo: sexoPaciente,
      fechaNacimiento: fechaNacimientoPaciente,
      fechaReferencia: fechaNota || format(new Date(), 'yyyy-MM-dd'),
      pesoKg: pesoVal,
      tallaCm: alturaVal,
    }).then((res) => { if (!cancelado) setPediatrico(res) })
    return () => { cancelado = true }
  }, [esMenor, fechaNacimientoPaciente, sexoPaciente, fechaNota, pesoVal, alturaVal])

  const calcImc: ResultadoCalc = (() => {
    if (!pesoVal || !alturaVal) return hint('Completá peso y altura')
    const imc = calcularIMC(pesoVal, alturaVal)
    if (imc == null) return hint('Completá peso y altura')
    if (esMenor) {
      if (!pediatrico) return { val: f1(imc) }
      const imcLabel = IMC_PEDIATRICO_LABEL[pediatrico.imcCategoria]
      const tallaLabel = pediatrico.tallaCategoria === 'baja_talla' ? 'Baja talla' : 'Talla adecuada'
      const anios = Math.floor(pediatrico.edadMeses / 12)
      const mesesResto = pediatrico.edadMeses % 12
      return { val: f1(imc), sub: `${imcLabel}<br>${tallaLabel}<br>Pediátrico · OMS · ${anios} a ${mesesResto} m` }
    }
    const c = clasificarIMC(imc, edadPaciente)
    return { val: f1(imc), sub: c?.label }
  })()

  const calcGeb: ResultadoCalc = (() => {
    const p = n(v('peso')); const a = n(v('alt'))
    if (!p || !a) return hint('Completá peso, altura, edad y sexo')
    const geb = calcularGEB(p, a, edadPaciente, sexoPaciente, formula)
    if (geb == null) return hint('Completá peso, altura, edad y sexo')
    return { val: `${f0(geb)} kcal`, sub: `${sexoPaciente === 'M' ? 'Masculino' : sexoPaciente === 'F' ? 'Femenino' : ''} · ${edadPaciente ?? '–'} años` }
  })()

  const calcPeso: ResultadoCalc = (() => {
    const p = n(v('peso'))
    if (!p) return hint('Completá el peso actual para comparar')
    if (!ultimoPeso) return { val: '–', sub: 'Sin registros previos' }
    const fechaFmt = new Date(ultimoPeso.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    return { val: dl(p, ultimoPeso.peso, 'kg'), sub: `Última: ${f1(ultimoPeso.peso)} kg · ${fechaFmt}` }
  })()

  return (
    <div className="cols">
      <section className={`mod ${closed ? 'closed' : ''}`}>
        <button type="button" className="modh" onClick={() => setClosed((c) => !c)}>
          Datos antropométricos
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="modb">
          <Grilla cols={3}>
            <CampoNum label="Peso" unit="kg" value={v('peso')} onChange={(x) => onChange('peso', x)} />
            <CampoNum label="Altura" unit="cm" value={v('alt')} onChange={(x) => onChange('alt', x)} />
            <CampoNum label="Cintura" unit="cm" value={v('cin')} onChange={(x) => onChange('cin', x)} />
            <CampoNum label="Cadera" unit="cm" value={v('cad')} onChange={(x) => onChange('cad', x)} />
            <CampoNum label="% Grasa" unit="%" value={v('grasa')} onChange={(x) => onChange('grasa', x)} />
            <CampoNum label="% Músculo" unit="%" value={v('musc')} onChange={(x) => onChange('musc', x)} />
          </Grilla>
          <Colapsable titulo="Pliegues cutáneos y perímetros" open={pliegOpen} onToggle={() => setPliegOpen((o) => !o)}>
            <Grilla cols={3}>
              <CampoNum label="Tricipital" unit="mm" value={v('tri')} onChange={(x) => onChange('tri', x)} />
              <CampoNum label="Subescapular" unit="mm" value={v('sub')} onChange={(x) => onChange('sub', x)} />
              <CampoNum label="Suprailíaco" unit="mm" value={v('supra')} onChange={(x) => onChange('supra', x)} />
              <CampoNum label="Abdominal" unit="mm" value={v('abd')} onChange={(x) => onChange('abd', x)} />
              <CampoNum label="Brazo" unit="cm" value={v('brazo')} onChange={(x) => onChange('brazo', x)} />
              <CampoNum label="Pantorrilla" unit="cm" value={v('pant')} onChange={(x) => onChange('pant', x)} />
            </Grilla>
          </Colapsable>
        </div>
      </section>
      <div className="calc">
        <TarjetaCalc label="IMC" resultado={calcImc} />
        <TarjetaCalc
          label="Gasto energético basal (GEB)"
          resultado={calcGeb}
          tog={{ opciones: ['Mifflin-St Jeor', 'Harris-Benedict'], valor: formula === 'mifflin' ? 0 : 1, onChange: (i) => setFormula(i === 0 ? 'mifflin' : 'harris') }}
        />
        <TarjetaCalc label="Peso vs. última consulta" resultado={calcPeso} />
      </div>
    </div>
  )
}
