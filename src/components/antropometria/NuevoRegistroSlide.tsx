'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInYears, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useEffectiveTerapeutaId } from '@/lib/auth/useEffectiveTerapeutaId'
import SlideOver from '@/components/ui/SlideOver'
import {
  calcular, fmt, somatochart,
  type Medidas, type Paciente as PacienteCalculo,
} from '@/lib/antropometria'
import type { RegistroAntropometrico } from '@/types/database'
import './nuevo-registro.css'

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombre: string
  pacienteApellido: string
  pacienteGenero: string | null
  pacienteFechaNacimiento: string | null
  /** Registro a editar. null = alta de un registro nuevo. */
  registro: RegistroAntropometrico | null
}

type Metodo = 'basico' | 'isak' | 'otro'

type CampoISAK = [clave: string, etiqueta: string, unidad: string]
type Seccion = { sec: string; titulo: string; items: CampoISAK[] }

const SECCIONES: Seccion[] = [
  { sec: 'basicas', titulo: 'Medidas básicas', items: [
    ['masa', 'Masa corporal', 'kg'], ['talla', 'Talla', 'cm'], ['tallaSentado', 'Talla sentado', 'cm'], ['envergadura', 'Envergadura', 'cm'],
  ] },
  { sec: 'pliegues', titulo: 'Pliegues cutáneos', items: [
    ['tri', 'Tríceps', 'mm'], ['sub', 'Subescapular', 'mm'], ['bic', 'Bíceps', 'mm'], ['cresta', 'Cresta ilíaca', 'mm'],
    ['supra', 'Supraespinal', 'mm'], ['abd', 'Abdominal', 'mm'], ['muslo', 'Muslo frontal', 'mm'], ['pierna', 'Pierna medial', 'mm'],
  ] },
  { sec: 'perimetros', titulo: 'Perímetros', items: [
    ['pBrazoR', 'Brazo relajado', 'cm'], ['pBrazoC', 'Brazo flexionado y contraído', 'cm'], ['pCintura', 'Cintura', 'cm'],
    ['pCadera', 'Cadera', 'cm'], ['pMuslo', 'Muslo medio', 'cm'], ['pPierna', 'Pierna', 'cm'],
  ] },
  { sec: 'diametros', titulo: 'Diámetros óseos', items: [
    ['dHumero', 'Húmero (biepicondilar)', 'cm'], ['dBiest', 'Biestiloideo (muñeca)', 'cm'], ['dFemur', 'Fémur (bicondilar)', 'cm'],
  ] },
]

const BASICO: CampoISAK[] = [
  ['masa', 'Peso', 'kg'], ['talla', 'Altura', 'cm'], ['pCintura', 'Cintura', 'cm'],
  ['pCadera', 'Cadera', 'cm'], ['pGrasa', '% Grasa', '%'], ['pMusc', '% Músculo', '%'],
]

// UI (isak-data.js) → Medidas de la librería de cálculo
const UI_A_LIB: Record<string, keyof Medidas> = {
  masa: 'masa', talla: 'talla', tallaSentado: 'tallaSentado', envergadura: 'envergadura',
  tri: 'triceps', sub: 'subescapular', bic: 'biceps', cresta: 'crestaIliaca',
  supra: 'supraespinal', abd: 'abdominal', muslo: 'muslo', pierna: 'pantorrilla',
  pBrazoR: 'brazoRelajado', pBrazoC: 'brazoContraido', pCintura: 'cintura', pCadera: 'cadera',
  pMuslo: 'musloMedio', pPierna: 'pierna',
  dHumero: 'humero', dBiest: 'biestiloideo', dFemur: 'femur',
}

// UI → columna de registros_antropometricos
const UI_A_DB: Record<string, keyof RegistroAntropometrico> = {
  masa: 'peso', talla: 'altura', tallaSentado: 'talla_sentado', envergadura: 'envergadura',
  tri: 'pliegue_tricipital', sub: 'pliegue_subescapular', bic: 'pliegue_biceps', cresta: 'pliegue_cresta_iliaca',
  supra: 'pliegue_supraespinal', abd: 'pliegue_abdominal', muslo: 'pliegue_muslo', pierna: 'pliegue_pantorrilla',
  pBrazoR: 'perimetro_brazo', pBrazoC: 'perimetro_brazo_contraido', pCintura: 'cintura', pCadera: 'cadera',
  pMuslo: 'perimetro_muslo_medio', pPierna: 'perimetro_pierna',
  dHumero: 'diametro_humero', dBiest: 'diametro_biestiloideo', dFemur: 'diametro_femur',
  pGrasa: 'porcentaje_grasa', pMusc: 'porcentaje_musculo',
}

const DB_A_UI: Record<string, string> = Object.fromEntries(Object.entries(UI_A_DB).map(([ui, db]) => [db, ui]))

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function numDesde(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? null : n
}

function formatoCampo(v: number | null | undefined): string {
  if (v == null) return ''
  return String(v).replace('.', ',')
}

function valsDesdeRegistro(r: RegistroAntropometrico): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [db, ui] of Object.entries(DB_A_UI)) {
    const v = (r as unknown as Record<string, number | null>)[db]
    if (v != null) out[ui] = formatoCampo(v)
  }
  return out
}

function medidasDesdeVals(vals: Record<string, string>): Medidas {
  const m: Medidas = {}
  for (const [ui, libKey] of Object.entries(UI_A_LIB)) {
    const n = numDesde(vals[ui])
    if (n != null) (m as Record<string, number>)[libKey] = n
  }
  return m
}

export default function NuevoRegistroSlide({
  open, onClose, pacienteId, pacienteNombre, pacienteApellido, pacienteGenero, pacienteFechaNacimiento, registro,
}: Props) {
  const router = useRouter()
  const esEdicion = !!registro
  const { terapeutaId } = useEffectiveTerapeutaId()

  const [metodo, setMetodo] = useState<Metodo>('isak')
  const [fecha, setFecha] = useState(hoy())
  const [vals, setVals] = useState<Record<string, string>>({})
  const [metodoOtroNombre, setMetodoOtroNombre] = useState('')
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({
    basicas: true, pliegues: true, perimetros: true, diametros: true,
  })
  const [resBarAbierta, setResBarAbierta] = useState(false)
  const [previo, setPrevio] = useState<RegistroAntropometrico | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Reinicia el formulario cada vez que se abre (alta o edición de otro registro)
  useEffect(() => {
    if (!open) return
    if (registro) {
      setMetodo((registro.metodo_medicion as Metodo) || 'isak')
      setFecha(registro.fecha)
      setVals(valsDesdeRegistro(registro))
      setMetodoOtroNombre(registro.metodo_otro ?? '')
    } else {
      setMetodo('isak')
      setFecha(hoy())
      setVals({})
      setMetodoOtroNombre('')
    }
    setSeccionesAbiertas({ basicas: true, pliegues: true, perimetros: true, diametros: true })
    setError(null)
  }, [open, registro])

  // Registro previo (para la comparación "Previo" y el punto gris de la somatocarta)
  useEffect(() => {
    if (!open) { setPrevio(null); return }
    let cancelado = false
    async function fetchPrevio() {
      const supabase = createClient()
      const { data } = await supabase
        .from('registros_antropometricos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false })
        .limit(registro ? 2 : 1)
      if (cancelado) return
      const filas = (data ?? []) as RegistroAntropometrico[]
      const otro = filas.find((r) => r.id !== registro?.id) ?? null
      setPrevio(otro)
    }
    fetchPrevio()
    return () => { cancelado = true }
  }, [open, pacienteId, registro])

  if (!open) return null

  // Sexo/edad del paciente — mismo patrón que NuevaNotaForm.tsx. Nunca se asume 'M': sin género cargado, sexo queda null.
  const edad = pacienteFechaNacimiento ? differenceInYears(new Date(), parseISO(pacienteFechaNacimiento)) : 30
  const sexo: PacienteCalculo['sexo'] = pacienteGenero === 'M' || pacienteGenero === 'F' ? pacienteGenero : null
  const paciente: PacienteCalculo = { sexo, edad }

  const medidas = medidasDesdeVals(vals)
  const resultado = calcular(medidas, paciente)

  const medidasPrevio = previo ? medidasDesdeVals(valsDesdeRegistro(previo)) : null
  const resultadoPrevio = medidasPrevio ? calcular(medidasPrevio, paciente) : null

  function iniciales(): string {
    return `${pacienteNombre[0] ?? ''}${pacienteApellido[0] ?? ''}`.toUpperCase()
  }

  function toggleSeccion(sec: string) {
    setSeccionesAbiertas((p) => ({ ...p, [sec]: !p[sec] }))
  }

  function actualizarVal(k: string, v: string) {
    setVals((p) => ({ ...p, [k]: v }))
  }

  function contadorSeccion(s: Seccion): [number, number] {
    const n = s.items.filter(([k]) => numDesde(vals[k]) != null).length
    return [n, s.items.length]
  }

  function cerrarConToast() {
    const n = Object.values(vals).filter((v) => numDesde(v) != null).length
    setToastMsg(n ? `Registro guardado · ${n} medidas` : 'Registro guardado sin medidas')
    setTimeout(() => {
      router.refresh()
      onClose()
    }, 900)
  }

  async function handleGuardar() {
    if (!esEdicion && !terapeutaId) {
      setError('No se pudo identificar al profesional. Recargá la página e intentá de nuevo.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const campos: Record<string, number | null> = {}
    const clavesRelevantes = metodo === 'isak' ? Object.keys(UI_A_DB).filter((k) => k !== 'pGrasa' && k !== 'pMusc') : BASICO.map(([k]) => k)
    for (const ui of clavesRelevantes) {
      const dbCol = UI_A_DB[ui]
      if (!dbCol) continue
      campos[dbCol] = numDesde(vals[ui])
    }

    const payload: Record<string, unknown> = {
      ...campos,
      fecha,
      metodo_medicion: metodo,
      perfil_medicion: metodo === 'isak' ? 'restringido' : undefined,
      metodo_otro: metodo === 'otro' ? (metodoOtroNombre.trim() || null) : null,
    }
    if (payload.perfil_medicion === undefined) delete payload.perfil_medicion

    if (esEdicion && registro) {
      const { error: dbError } = await supabase
        .from('registros_antropometricos')
        .update(payload as never)
        .eq('id', registro.id)
      if (dbError) {
        console.error('[NuevoRegistroSlide] error al actualizar registro antropométrico', dbError.code, dbError.message, dbError)
        setError('Error al guardar. Intentá de nuevo.'); setLoading(false); return
      }
    } else {
      const { error: dbError } = await supabase
        .from('registros_antropometricos')
        .insert({ ...payload, terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: null } as never)
      if (dbError) {
        console.error('[NuevoRegistroSlide] error al insertar registro antropométrico', dbError.code, dbError.message, dbError)
        setError('Error al guardar. Intentá de nuevo.'); setLoading(false); return
      }
    }

    setLoading(false)
    cerrarConToast()
  }

  const n6 = 6 - (resultado.faltan.s6?.length ?? 0)
  const faltanSomatotipo = Array.from(new Set([
    ...(resultado.faltan.endo ?? []),
    ...(resultado.faltan.meso ?? []),
    ...(resultado.faltan.ecto ?? []),
  ]))

  const puntosSomatocarta = [
    resultadoPrevio && resultadoPrevio.somatotipo.x != null
      ? { x: resultadoPrevio.somatotipo.x, y: resultadoPrevio.somatotipo.y as number, kind: 'previo' as const }
      : null,
    resultado.somatotipo.x != null
      ? { x: resultado.somatotipo.x, y: resultado.somatotipo.y as number, kind: 'actual' as const }
      : null,
  ]

  const tarjetas = (
    <>
      <div className="nr-w-card">
        <div className="nr-w-lbl">IMC</div>
        {resultado.salud.imc != null ? (
          <>
            <div className="nr-w-val">{fmt(resultado.salud.imc, 1)}<span className="u">kg/m²</span></div>
            {previo && resultadoPrevio?.salud.imc != null && (
              <div className="nr-w-sec">Previo <b>{fmt(resultadoPrevio.salud.imc, 1)}</b></div>
            )}
          </>
        ) : (
          <div className="nr-w-placeholder">Completá masa corporal y talla</div>
        )}
      </div>

      {metodo === 'isak' && (
        <div className="nr-w-card">
          <div className="nr-w-lbl">Σ6 pliegues<span>{n6}/6</span></div>
          {resultado.sumatorias.s6 != null ? (
            <>
              <div className="nr-w-val">{fmt(resultado.sumatorias.s6, 1)}<span className="u">mm</span></div>
              <div className="nr-w-sec">
                {previo && resultadoPrevio?.sumatorias.s6 != null && <>Previo <b>{fmt(resultadoPrevio.sumatorias.s6, 1)}</b></>}
                {resultado.sumatorias.s8 != null && <> {previo ? '·' : ''} Σ8 <b>{fmt(resultado.sumatorias.s8, 1)} mm</b></>}
              </div>
            </>
          ) : (
            <>
              <div className="nr-w-placeholder">
                Faltan {6 - n6} de 6 pliegues: {(resultado.faltan.s6 ?? []).join(', ')}
              </div>
              <div className="nr-prog"><i style={{ width: `${(n6 / 6) * 100}%` }} /></div>
            </>
          )}
        </div>
      )}

      {metodo === 'isak' && (
        <div className="nr-w-card">
          <div className="nr-w-lbl">Somatotipo<span>Heath-Carter</span></div>
          <div className="nr-w-soma">
            {([['Endo', resultado.somatotipo.endo], ['Meso', resultado.somatotipo.meso], ['Ecto', resultado.somatotipo.ecto]] as [string, number | null][]).map(([l, v]) => (
              <div key={l}><small>{l}</small><b className={v == null ? 'na' : ''}>{v == null ? '—' : fmt(v, 2)}</b></div>
            ))}
          </div>
          <div dangerouslySetInnerHTML={{ __html: somatochart(puntosSomatocarta, { w: 228, labels: true }) }} />
          {previo && (
            <div className="nr-w-leg">
              <span><i className="nr-sa" />Actual</span>
              <span><i className="nr-sp" />Previo {previo.fecha.split('-').reverse().join('/')}</span>
            </div>
          )}
          {faltanSomatotipo.length > 0 && (
            <p className="nr-w-miss"><b>Falta:</b> {faltanSomatotipo.join(', ')}</p>
          )}
        </div>
      )}
    </>
  )

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={esEdicion ? 'Editar registro antropométrico' : 'Nuevo registro antropométrico'}
        width="560"
        noPadding
        header={
          <header className="nr-hdr">
            <div className="nr-av">{iniciales()}</div>
            <div className="nr-h-info">
              <div className="nr-name">{esEdicion ? 'Editar registro antropométrico' : 'Nuevo registro antropométrico'}</div>
              <div className="nr-meta">
                <span>{pacienteNombre} {pacienteApellido}</span>
                <span>{sexo ?? 'Sexo no cargado'} · {edad} años</span>
                {previo && <span>Último registro {previo.fecha.split('-').reverse().join('/')}</span>}
              </div>
            </div>
            <button type="button" className="nr-close" aria-label="Cerrar" onClick={onClose}>
              <svg viewBox="0 0 24 24" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={1.8} fill="none" /></svg>
            </button>
          </header>
        }
        footer={
          <footer className="nr-foot">
            <button type="button" className="nr-btn" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="button" className="nr-btn primary" onClick={handleGuardar} disabled={loading}>
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth={1.8} fill="none" /></svg>
              {loading ? 'Guardando…' : 'Guardar registro'}
            </button>
          </footer>
        }
      >
        <div className="nr-body">
          {error && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="nr-top-row">
            <div>
              <span className="nr-fl">Método</span>
              <div className="nr-seg" role="radiogroup" aria-label="Método">
                {([['basico', 'Básico'], ['isak', 'ISAK'], ['otro', 'Otro']] as [Metodo, string][]).map(([m, l]) => (
                  <button key={m} type="button" role="radio" aria-checked={metodo === m} className={metodo === m ? 'on' : ''} onClick={() => setMetodo(m)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="nr-af">
              <label htmlFor="nr-fecha">Fecha</label>
              <div className="input-wrap"><input id="nr-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            </div>
          </div>

          {metodo === 'isak' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {SECCIONES.map((s) => {
                const [n, t] = contadorSeccion(s)
                const abierta = seccionesAbiertas[s.sec]
                return (
                  <section key={s.sec} className={`nr-sec-block${abierta ? ' open' : ''}`}>
                    <button type="button" className="nr-sec-block-hdr" aria-expanded={abierta} onClick={() => toggleSeccion(s.sec)}>
                      <span className="ttl">{s.titulo}</span>
                      <span className={`sub${n === t ? ' full' : ''}`}>{n}/{t}</span>
                      <svg className="chev" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {abierta && (
                      <div className="nr-sec-block-body">
                        <div className={`nr-grid${s.items.length % 4 === 0 ? ' c4' : ''}`}>
                          {s.items.map(([k, l, u]) => (
                            <div key={k} className="nr-af">
                              <label htmlFor={`nr-f-${k}`} title={l}>{l}</label>
                              <div className="input-wrap">
                                <input id={`nr-f-${k}`} inputMode="decimal" placeholder="0" value={vals[k] ?? ''} onChange={(e) => actualizarVal(k, e.target.value)} />
                                <span className="unit">{u}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <section className="nr-sec-block open">
              <div className="nr-sec-block-hdr" style={{ cursor: 'default' }}>
                <span className="ttl">Datos antropométricos</span>
              </div>
              <div className="nr-sec-block-body">
                {metodo === 'otro' && (
                  <div className="nr-af" style={{ marginBottom: 14 }}>
                    <label htmlFor="nr-f-nm">Nombre del método</label>
                    <div className="input-wrap">
                      <input id="nr-f-nm" className="txt" placeholder="Ej.: bioimpedancia" value={metodoOtroNombre} onChange={(e) => setMetodoOtroNombre(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="nr-grid">
                  {BASICO.map(([k, l, u]) => (
                    <div key={k} className="nr-af">
                      <label htmlFor={`nr-f-${k}`} title={l}>{l}</label>
                      <div className="input-wrap">
                        <input id={`nr-f-${k}`} inputMode="decimal" placeholder="0" value={vals[k] ?? ''} onChange={(e) => actualizarVal(k, e.target.value)} />
                        <span className="unit">{u}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <p className="nr-hint">
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
            <span>Todas las medidas son opcionales. Podés guardar con datos parciales y completar el resto después.</span>
          </p>
        </div>

        <div className={`nr-res-bar${resBarAbierta ? ' open' : ''}`}>
          <button type="button" className="nr-rb-toggle" aria-expanded={resBarAbierta} onClick={() => setResBarAbierta((v) => !v)}>
            <span>IMC <b>{resultado.salud.imc != null ? fmt(resultado.salud.imc, 1) : '—'}</b></span>
            {metodo === 'isak' && (
              <>
                <span className="sep">·</span>
                <span>Σ6 <b>{resultado.sumatorias.s6 != null ? fmt(resultado.sumatorias.s6, 1) : '—'}</b></span>
                <span className="sep">·</span>
                <span>Somatotipo <b>{[resultado.somatotipo.endo, resultado.somatotipo.meso, resultado.somatotipo.ecto].map((v) => v == null ? '—' : fmt(v, 1)).join(' / ')}</b></span>
              </>
            )}
            <svg className="rb-chev" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
          {resBarAbierta && <div className="nr-rb-body">{tarjetas}</div>}
        </div>
      </SlideOver>

      <aside className="nr-res-side" style={{ right: 560 }} aria-label="Resultados calculados">
        {tarjetas}
      </aside>

      <div className={`nr-toast${toastMsg ? ' on' : ''}`}>
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth={2} fill="none" /></svg>
        <span>{toastMsg}</span>
      </div>
    </>
  )
}
