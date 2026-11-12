'use client'

import { useEffect, useState } from 'react'
import { gramosDesdeMacro } from '@/lib/nutricion/calculos'
import { hoyFechaAR } from '@/lib/tz'
import { diaSemanaKey, formatCorto } from '@/lib/portal/semana'
import FoodThumb from '@/components/nutricion/FoodThumb'

const IconCheck = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--ok)', strokeWidth: 2.2, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const IconDoc = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'var(--accent-ink)', strokeWidth: 1.7, fill: 'none' }}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h5" /></svg>

const DIA_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIA_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const MACRO_DEFS: { key: 'carbohidratos' | 'proteinas' | 'grasas'; nombre: string; kcalPorGramo: 4 | 9 }[] = [
  { key: 'carbohidratos', nombre: 'Carbohidratos', kcalPorGramo: 4 },
  { key: 'proteinas', nombre: 'Proteínas', kcalPorGramo: 4 },
  { key: 'grasas', nombre: 'Grasas', kcalPorGramo: 9 },
]

type Item = { tipo: string; nombre: string; cantidadGramos: number | null; imageUrl: string | null }
type Comida = { diaSemana: string; tipoComida: string; hora: string | null; nota: string | null; items: Item[] }
type PlanData = {
  noPlan: boolean
  profesionalNombreCorto?: string
  objetivoTitulo?: string | null
  objetivoNota?: string | null
  kcalObjetivo?: number | null
  porcentajeCarbohidratos?: number
  porcentajeProteinas?: number
  porcentajeGrasas?: number
  indicaciones?: string[]
  fechaPreparacion?: string
  comidas?: Comida[]
  kcalPorDia?: Record<string, number>
  mostrarMacros?: boolean
}

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function PlanClient() {
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [diaSel, setDiaSel] = useState(() => diaSemanaKey(hoyFechaAR()))

  useEffect(() => {
    fetch('/api/portal/plan')
      .then((res) => jsonOrNull(res))
      .then((body) => { if (body) setData(body) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <h1 className="pp-ph1">Mi plan</h1>
        <div className="pp-card pp-goal">
          <div className="pp-sk" style={{ height: 12, width: '30%' }} />
          <div className="pp-sk" style={{ height: 18, width: '70%', marginTop: 10 }} />
          <div className="pp-sk" style={{ height: 12, width: '90%', marginTop: 12 }} />
        </div>
        <div className="pp-sk" style={{ height: 46, margin: '20px 0 12px', borderRadius: 8 }} />
        <div className="pp-meals">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="pp-mrow pp-static" key={i}>
              <div className="pp-mtx"><div className="pp-sk" style={{ height: 14, width: '42%' }} /></div>
            </div>
          ))}
        </div>
      </>
    )
  }

  if (!data || data.noPlan) {
    return (
      <>
        <h1 className="pp-ph1">Mi plan</h1>
        <div className="pp-empty">
          <div className="pp-ic">{IconDoc}</div>
          <h3>Tu profesional todavía no te cargó un plan</h3>
          <p>Cuando lo cargue, lo vas a ver acá, día por día.</p>
        </div>
      </>
    )
  }

  const comidasDelDia = (data.comidas ?? []).filter((c) => c.diaSemana === diaSel)
  const kcalDia = data.kcalPorDia?.[diaSel]

  return (
    <>
      <h1 className="pp-ph1">Mi plan</h1>
      <p className="pp-sub">Indicado por {data.profesionalNombreCorto} · vigente desde el {data.fechaPreparacion ? formatCorto(data.fechaPreparacion.slice(0, 10)) : '—'}</p>

      {(data.objetivoTitulo || data.objetivoNota) && (
        <div className="pp-card pp-goal">
          <div className="pp-lbl">Objetivo</div>
          {data.objetivoTitulo && <p className="pp-v">{data.objetivoTitulo}</p>}
          {data.objetivoNota && <p>{data.objetivoNota}</p>}
        </div>
      )}

      {data.mostrarMacros && data.kcalObjetivo != null && (
        <div className="pp-card" style={{ marginTop: 10 }}>
          <div className="pp-lbl">Valor calórico diario</div>
          <div className="pp-kc"><b>{data.kcalObjetivo ?? '—'}</b><span>kcal por día</span></div>
          {MACRO_DEFS.map((m) => {
            const pct = m.key === 'carbohidratos' ? data.porcentajeCarbohidratos : m.key === 'proteinas' ? data.porcentajeProteinas : data.porcentajeGrasas
            const gramos = gramosDesdeMacro(data.kcalObjetivo ?? null, pct ?? 0, m.kcalPorGramo)
            return (
              <div className="pp-mac" key={m.key}>
                <b>{m.nombre}</b><span className="pp-p">{pct ?? 0} %</span><span className="pp-g">{gramos} g</span>
              </div>
            )
          })}
        </div>
      )}

      {(data.indicaciones?.length ?? 0) > 0 && (
        <div className="pp-card" style={{ marginTop: 10 }}>
          <div className="pp-lbl">Indicaciones</div>
          <ul className="pp-tips">
            {data.indicaciones!.map((t, i) => <li key={i}>{IconCheck}<span>{t}</span></li>)}
          </ul>
        </div>
      )}

      <div className="pp-days-wrap">
        <div className="pp-days" role="group" aria-label="Día de la semana">
          {DIA_ORDEN.map((dia, i) => (
            <button key={dia} className={diaSel === dia ? 'on' : ''} aria-pressed={diaSel === dia} onClick={() => setDiaSel(dia)}>
              {DIA_CORTO[i]}
            </button>
          ))}
        </div>
      </div>

      <div className="pp-card" style={{ padding: 0 }}>
        {comidasDelDia.length === 0 && (
          <p style={{ margin: 0, padding: 16, fontSize: 14, color: 'var(--muted)' }}>Sin comidas cargadas para este día.</p>
        )}
        {comidasDelDia.map((c) => {
          // Ítems de texto libre con contenido vacío no se muestran — no
          // son un alimento cargado, son un placeholder sin completar.
          const items = c.items.filter((item) => item.tipo !== 'texto_libre' || item.nombre.trim().length > 0)
          return (
            <div className="pp-pmeal" key={c.tipoComida}>
              <div className="pp-meal-hd"><b>{c.tipoComida}</b>{c.hora && <span>{c.hora.slice(0, 5)}</span>}</div>
              <ul className="pp-items">
                {items.length === 0 && <li>Sin ítems cargados.</li>}
                {items.map((item, i) => (
                  <li key={i} className={item.tipo === 'alimento' ? undefined : 'free'}>
                    <FoodThumb size={56} src={item.imageUrl} />
                    <div>
                      <span className="nm" title={item.nombre}>{item.nombre}</span>
                      {item.tipo === 'alimento' && item.cantidadGramos != null && <span className="rs">{item.cantidadGramos} g</span>}
                    </div>
                  </li>
                ))}
              </ul>
              {c.nota && <p className="pp-ptip">{c.nota}</p>}
            </div>
          )
        })}
      </div>

      {data.mostrarMacros && kcalDia != null && (
        <p className="pp-sub" style={{ fontSize: 13, marginTop: 10 }}>{DIA_LARGO[DIA_ORDEN.indexOf(diaSel)]}: ≈ {Math.round(kcalDia)} kcal</p>
      )}
    </>
  )
}
