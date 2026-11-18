import { notFound, redirect } from 'next/navigation'
import { differenceInYears, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import {
  calcular, fmt, sgn, fecha as fmtFecha, somatochart, pie, medidasDesdeRegistro, zPhantom, zTalla,
  categoriaCormico, categoriaManouvrier, categoriaEnvergadura, categoriaConicidad, lecturaSomatotipo,
  CATEGORIAS_MUSCULO_OSEO, RANGOS_MUSCULO_OSEO, CORTES_SALUD, CORTES_CONICIDAD_POR_SEXO,
  TEXTOS_SOMATOTIPO, ACLARACION_ESCALA_SOMATOTIPO,
  TEXTOS_CORMICO, TEXTOS_MANOUVRIER, TEXTOS_ENVERGADURA, REFERENCIA_CORMICO, REFERENCIA_MANOUVRIER, REFERENCIA_ENVERGADURA,
  FUENTES,
  type Paciente as PacienteCalculo, type Sexo, type Medidas, type VariablePhantom,
} from '@/lib/antropometria'
import type { RegistroAntropometrico } from '@/types/database'
import ImprimirButton from '../../historial/exportar/ImprimirButton'
import './informe-print.css'

export const metadata = { title: 'Informe antropométrico — KLIA', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

interface CampoDef { clave: keyof Medidas; label: string; unidad: string; phantom: 'talla' | Exclude<keyof Medidas, 'talla'> }

const SECCIONES: { titulo: string; items: CampoDef[] }[] = [
  { titulo: 'Medidas básicas', items: [
    { clave: 'masa', label: 'Masa corporal', unidad: 'kg', phantom: 'masa' },
    { clave: 'talla', label: 'Talla', unidad: 'cm', phantom: 'talla' },
    { clave: 'tallaSentado', label: 'Talla sentado', unidad: 'cm', phantom: 'tallaSentado' },
    { clave: 'envergadura', label: 'Envergadura', unidad: 'cm', phantom: 'envergadura' },
  ] },
  { titulo: 'Pliegues cutáneos', items: [
    { clave: 'triceps', label: 'Tríceps', unidad: 'mm', phantom: 'triceps' },
    { clave: 'subescapular', label: 'Subescapular', unidad: 'mm', phantom: 'subescapular' },
    { clave: 'biceps', label: 'Bíceps', unidad: 'mm', phantom: 'biceps' },
    { clave: 'crestaIliaca', label: 'Cresta ilíaca', unidad: 'mm', phantom: 'crestaIliaca' },
    { clave: 'supraespinal', label: 'Supraespinal', unidad: 'mm', phantom: 'supraespinal' },
    { clave: 'abdominal', label: 'Abdominal', unidad: 'mm', phantom: 'abdominal' },
    { clave: 'muslo', label: 'Muslo frontal', unidad: 'mm', phantom: 'muslo' },
    { clave: 'pantorrilla', label: 'Pierna medial', unidad: 'mm', phantom: 'pantorrilla' },
  ] },
  { titulo: 'Perímetros', items: [
    { clave: 'brazoRelajado', label: 'Brazo relajado', unidad: 'cm', phantom: 'brazoRelajado' },
    { clave: 'brazoContraido', label: 'Brazo flexionado y contraído', unidad: 'cm', phantom: 'brazoContraido' },
    { clave: 'cintura', label: 'Cintura', unidad: 'cm', phantom: 'cintura' },
    { clave: 'cadera', label: 'Cadera', unidad: 'cm', phantom: 'cadera' },
    { clave: 'musloMedio', label: 'Muslo medio', unidad: 'cm', phantom: 'musloMedio' },
    { clave: 'pierna', label: 'Pierna', unidad: 'cm', phantom: 'pierna' },
  ] },
  { titulo: 'Diámetros óseos', items: [
    { clave: 'humero', label: 'Húmero (biepicondilar)', unidad: 'cm', phantom: 'humero' },
    { clave: 'biestiloideo', label: 'Biestiloideo (muñeca)', unidad: 'cm', phantom: 'biestiloideo' },
    { clave: 'femur', label: 'Fémur (bicondilar)', unidad: 'cm', phantom: 'femur' },
  ] },
]

const TEJIDOS_DEF = [
  { clave: 'adiposo' as const, label: 'Adiposo', colorVar: 'var(--warn)', colorHex: '#A65A06' },
  { clave: 'muscular' as const, label: 'Muscular', colorVar: 'var(--accent)', colorHex: '#1F4FD9' },
  { clave: 'oseo' as const, label: 'Óseo', colorVar: 'var(--ink-2)', colorHex: '#1F2937' },
]

function avisoFaltante(sexo: Sexo | null, edad: number | null, necesita: { sexo?: boolean; edad?: boolean }): string | null {
  const faltaSexo = !!necesita.sexo && sexo === null
  const faltaEdad = !!necesita.edad && edad === null
  if (faltaSexo && faltaEdad) return 'Cargá el sexo y la fecha de nacimiento del paciente para ver este índice.'
  if (faltaSexo) return 'Cargá el sexo del paciente para ver este índice.'
  if (faltaEdad) return 'Cargá la fecha de nacimiento del paciente para ver este índice.'
  return null
}

function dias(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

export default async function InformeAntropometriaPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { registro?: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')
  if (efectivo.esColaborador) redirect(`/pacientes/${params.id}`)

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('nombre, apellido, genero, fecha_nacimiento')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  if (!paciente) notFound()

  const [{ data: profile }, { data: registrosData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre, apellido, email, antropometria_certificacion')
      .eq('id', efectivo.terapeutaId)
      .single(),
    supabase
      .from('registros_antropometricos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('metodo_medicion', 'isak')
      .order('fecha', { ascending: true }),
  ])

  const registros = (registrosData ?? []) as RegistroAntropometrico[]
  if (registros.length === 0) notFound()

  const curId = searchParams?.registro
  const cur = (curId && registros.find((r) => r.id === curId)) || registros[registros.length - 1]
  const anteriores = registros.filter((r) => r.fecha < cur.fecha)
  const prev = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null
  const hasP = !!prev
  const numeroEvaluacion = registros.filter((r) => r.fecha <= cur.fecha).length

  const sexo: Sexo | null = paciente.genero === 'M' || paciente.genero === 'F' ? paciente.genero : null
  const edad = paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) : null
  const pac: PacienteCalculo = { sexo, edad }
  const sexoLabel = sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : '—'

  const medidasCur = medidasDesdeRegistro(cur)
  const R = calcular(medidasCur, pac)
  const RP = prev ? calcular(medidasDesdeRegistro(prev), pac) : null

  const esMenorConocido = edad !== null && !R.esAdulto
  const edadDesconocida = edad === null

  const protocolo = `ISAK${profile?.antropometria_certificacion ? ` · ${profile.antropometria_certificacion}` : ''}`
  const nombreProfesional = profile ? `${profile.nombre} ${profile.apellido}` : ''

  // Controles graficados para la somatocarta (>2 evaluaciones): todos los registros ISAK del paciente.
  const historicos = registros.map((r) => {
    const rr = r.id === cur.id ? R : calcular(medidasDesdeRegistro(r), pac)
    return { r, resultado: rr, kind: (r.id === cur.id ? 'actual' : r.id === prev?.id ? 'previo' : 'historico') as 'actual' | 'previo' | 'historico' }
  })
  const puntosSomatocarta = historicos.map(({ resultado, kind }) =>
    resultado.somatotipo.x != null && resultado.somatotipo.y != null
      ? { x: resultado.somatotipo.x, y: resultado.somatotipo.y, kind }
      : null,
  )
  const hayMasDeDosControles = registros.length > 2

  const PAGINAS: { titulo: string; subtitulo: string; body: React.ReactNode }[] = []

  // ---------- P1: Datos ----------
  const tablasP1 = SECCIONES.map((s) => (
    <div key={s.titulo}>
      <h3 className="isak-sub">{s.titulo}</h3>
      <table>
        <thead>
          <tr>
            <th>Medida</th>
            <th className="n">Actual</th>
            {hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}
            {!esMenorConocido && <th className="n">Z-score (Phantom)</th>}
          </tr>
        </thead>
        <tbody>
          {s.items.map((it) => {
            const actual = (medidasCur[it.clave] ?? null) as number | null
            const previoVal = prev ? ((medidasDesdeRegistro(prev)[it.clave] ?? null) as number | null) : null
            const z = esMenorConocido ? null : it.phantom === 'talla' ? zTalla(actual) : zPhantom(it.phantom as VariablePhantom, actual, medidasCur.talla ?? null)
            return (
              <tr key={it.clave}>
                <td>{it.label}<span className="u">{it.unidad}</span></td>
                <td className={`n${actual == null ? ' miss' : ''}`}>
                  {actual == null ? <>—<span className="isak-falta">Falta: {it.label.toLowerCase()}</span></> : fmt(actual, 1)}
                </td>
                {hasP && (
                  <>
                    <td className="n">{fmt(previoVal, 1)}</td>
                    <td className="n">{actual == null || previoVal == null ? '—' : sgn(actual - previoVal, 1)}</td>
                  </>
                )}
                {!esMenorConocido && <td className="n">{z == null ? '—' : sgn(z, 2)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  ))

  PAGINAS.push({
    titulo: 'Datos', subtitulo: 'Medidas relevadas',
    body: (
      <>
        {esMenorConocido && (
          <div className="isak-aviso"><b>Paciente menor de 18 años.</b> Se ocultan la composición tisular, los Z-scores (Phantom) y la clasificación del IMC: estas referencias están validadas en adultos.</div>
        )}
        {!hasP && <div className="isak-info">Primera evaluación del paciente: todavía no hay un control previo para comparar.</div>}
        {tablasP1}
      </>
    ),
  })

  // ---------- P2: Composición corporal ----------
  if (esMenorConocido) {
    PAGINAS.push({
      titulo: 'Composición corporal', subtitulo: 'Fraccionamiento tisular',
      body: <div className="isak-aviso"><b>Paciente menor de 18 años.</b> La composición tisular (Kerr) está validada en adultos y no se calcula ni se muestra en menores.</div>,
    })
  } else if (edadDesconocida) {
    PAGINAS.push({
      titulo: 'Composición corporal', subtitulo: 'Fraccionamiento tisular',
      body: <div className="isak-info">Cargá la fecha de nacimiento del paciente para ver este índice.</div>,
    })
  } else {
    const masa = medidasCur.masa ?? null
    const tejidos = R.tejidos!
    const tejidosZ = R.tejidosZ!
    const okAll = TEJIDOS_DEF.every((t) => tejidos[t.clave] != null)
    const avisoSexo = avisoFaltante(sexo, edad, { sexo: true })
    const tabla = (
      <table>
        <thead>
          <tr>
            <th>Tejido</th><th className="n">Actual (kg)</th>
            {hasP && <><th className="n">Previo (kg)</th><th className="n">Diferencia</th></>}
            <th className="n">% del peso</th><th className="n">Z-score</th>
          </tr>
        </thead>
        <tbody>
          {TEJIDOS_DEF.map((t) => {
            const a = tejidos[t.clave]
            const p = RP?.tejidos?.[t.clave] ?? null
            const z = tejidosZ[t.clave]
            return (
              <tr key={t.clave}>
                <td>{t.label}</td>
                <td className={`n${a == null ? ' miss' : ''}`}>
                  {a == null ? <>—{avisoSexo && t.clave === 'muscular' && <span className="isak-falta">{avisoSexo}</span>}</> : fmt(a, 2)}
                </td>
                {hasP && (
                  <>
                    <td className="n">{fmt(p, 2)}</td>
                    <td className="n">{a == null || p == null ? '—' : sgn(a - p, 2)}</td>
                  </>
                )}
                <td className="n">{a == null || masa == null ? '—' : `${fmt((a / masa) * 100, 1)} %`}</td>
                <td className="n">{z == null ? '—' : sgn(z, 2)}</td>
              </tr>
            )
          })}
          <tr className="isak-tot">
            <td>Masa corporal</td>
            <td className="n">{fmt(masa, 2)}</td>
            {hasP && (
              <>
                <td className="n">{fmt(prev!.peso, 2)}</td>
                <td className="n">{masa == null || prev!.peso == null ? '—' : sgn(masa - prev!.peso, 2)}</td>
              </>
            )}
            <td className="n"></td>
            <td className="n"></td>
          </tr>
        </tbody>
      </table>
    )
    const sumaTejidos = okAll ? TEJIDOS_DEF.reduce((t, c) => t + (tejidos[c.clave] as number), 0) : null
    const pieBody = okAll ? (
      <div className="isak-comp">
        <div dangerouslySetInnerHTML={{ __html: pie(TEJIDOS_DEF.map((t) => ({ v: tejidos[t.clave] as number, c: t.colorHex })), 150) }} />
        <div className="isak-leg">
          {TEJIDOS_DEF.map((t) => (
            <div key={t.clave}><i style={{ background: t.colorVar }} /><span>{t.label}</span><b>{fmt(((tejidos[t.clave] as number) / (sumaTejidos as number)) * 100, 1)} %</b></div>
          ))}
        </div>
      </div>
    ) : (
      <div className="isak-info">No se puede graficar la distribución: faltan tejidos por calcular.{avisoSexo && <span className="isak-falta">{avisoSexo}</span>}</div>
    )
    const prevMasa = prev?.peso ?? null
    const barras = (
      <div className="isak-bars">
        {TEJIDOS_DEF.map((t) => {
          const a = tejidos[t.clave], p = RP?.tejidos?.[t.clave] ?? null
          return (
            <div className="isak-br" key={t.clave}>
              <span>{t.label}</span>
              <div className="isak-tr">
                <div className="isak-ln">{a == null ? <span>— Actual</span> : <><span className="isak-track"><i style={{ width: `${masa ? (a / masa) * 100 : 0}%` }} /></span>{fmt(a, 2)} kg</>}</div>
                {hasP && <div className="isak-ln p">{p == null ? <span>—</span> : <><span className="isak-track"><i style={{ width: `${prevMasa ? (p / prevMasa) * 100 : 0}%` }} /></span>{fmt(p, 2)} kg</>}</div>}
              </div>
            </div>
          )
        })}
      </div>
    )
    PAGINAS.push({
      titulo: 'Composición corporal', subtitulo: 'Fraccionamiento tisular',
      body: (
        <>
          {tabla}
          <p className="isak-note">Fuente: Adiposo, {FUENTES.tejidoAdiposo} · Muscular, {FUENTES.tejidoMuscular} · Óseo, {FUENTES.tejidoOseo}</p>
          <div className="isak-grid2">
            <div className="isak-box"><div className="isak-bt">Distribución relativa de los tres tejidos</div>{pieBody}</div>
            <div className="isak-box">
              <div className="isak-bt">Actual vs previo<span>kg</span></div>
              {barras}
              <div className="isak-chart-leg" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                <span><i className="isak-sym-a" style={{ borderRadius: 2, width: 10, height: 8 }} />Actual</span>
                {hasP && <span><i style={{ width: 10, height: 8, background: 'var(--muted-3)', borderRadius: 2, display: 'inline-block' }} />Previo</span>}
              </div>
            </div>
          </div>
        </>
      ),
    })
  }

  // ---------- P3: Índices ----------
  {
    const avisoEdadSexoIndices = avisoFaltante(sexo, edad, { sexo: true, edad: true })
    let seccionIndices: React.ReactNode
    if (esMenorConocido) {
      seccionIndices = <div className="isak-aviso">Los índices adiposo/muscular y músculo/óseo se calculan a partir de la composición tisular y no se muestran en menores de 18 años.</div>
    } else if (edadDesconocida) {
      seccionIndices = <div className="isak-info">Cargá la fecha de nacimiento del paciente para ver estos índices.</div>
    } else {
      const tejidos = R.tejidos!
      const am = tejidos.adiposo != null && tejidos.muscular != null ? tejidos.adiposo / tejidos.muscular : null
      const amP = RP?.tejidos?.adiposo != null && RP?.tejidos?.muscular != null ? RP.tejidos.adiposo / RP.tejidos.muscular : null
      const mo = R.indices.musculoOseo
      const moP = RP?.indices.musculoOseo ?? null
      const cat = R.indices.musculoOseoCategoria
      const avisoSexo = avisoFaltante(sexo, edad, { sexo: true })
      if (mo == null && avisoSexo) {
        seccionIndices = (
          <div className="isak-grid2">
            <div className="isak-box"><div className="isak-bt">Índice adiposo / muscular</div><div className="isak-info">{avisoSexo}</div></div>
            <div className="isak-box"><div className="isak-bt">Índice músculo / óseo</div><div className="isak-info">{avisoSexo}</div></div>
          </div>
        )
      } else {
        const rangos = RANGOS_MUSCULO_OSEO[sexo as Sexo]
        const ci = cat ? CATEGORIAS_MUSCULO_OSEO.indexOf(cat) : -1
        const lo = rangos[0] - 0.5, hi = rangos[3] + 0.5
        const edges = [lo, ...rangos, hi]
        const segPos = mo == null || ci < 0 ? 0 : (ci + (Math.min(Math.max(mo, edges[ci]), edges[ci + 1]) - edges[ci]) / (edges[ci + 1] - edges[ci])) * 20
        const seg = [`< ${fmt(rangos[0], 2)}`, `${fmt(rangos[0], 2)}–${fmt(rangos[1], 2)}`, `${fmt(rangos[1], 2)}–${fmt(rangos[2], 2)}`, `${fmt(rangos[2], 2)}–${fmt(rangos[3], 2)}`, `> ${fmt(rangos[3], 2)}`]
        seccionIndices = (
          <div className="isak-grid2">
            <div className="isak-box">
              <div className="isak-bt">Índice adiposo / muscular</div>
              <div className="isak-big">{fmt(am, 2)}{hasP && amP != null && <small>Previo {fmt(amP, 2)} · {sgn((am ?? 0) - amP, 2)}</small>}</div>
              <p className="isak-note">Menor = más eficiente (menos tejido adiposo por cada kg de músculo).</p>
            </div>
            <div className="isak-box">
              <div className="isak-bt">Índice músculo / óseo<span>Rangos para {sexo === 'M' ? 'hombres' : 'mujeres'}</span></div>
              <div className="isak-big">{mo == null ? '—' : fmt(mo, 2)}{cat && <span className="isak-cat">{cat}</span>}{hasP && mo != null && moP != null && <small>Previo {fmt(moP, 2)}</small>}</div>
              <div className="isak-rng">
                <div className="isak-bar">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i === ci ? 'on' : ''} />)}
                  {mo != null && <span className="isak-mk" style={{ left: `${segPos}%` }} />}
                </div>
                <div className="isak-lbs">{CATEGORIAS_MUSCULO_OSEO.map((c, i) => <div key={c} className={i === ci ? 'on' : ''}><b>{c}</b>{seg[i]}</div>)}</div>
              </div>
              {FUENTES.musculoOseo && <p className="isak-note">Fuente: {FUENTES.musculoOseo}</p>}
            </div>
          </div>
        )
      }
    }
    const sumT = (
      <table>
        <thead><tr><th>Sumatoria de pliegues</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}</tr></thead>
        <tbody>
          <tr>
            <td>Σ6 pliegues<span className="u">mm</span></td>
            <td className="n">{fmt(R.sumatorias.s6, 1)}</td>
            {hasP && <><td className="n">{fmt(RP?.sumatorias.s6 ?? null, 1)}</td><td className="n">{R.sumatorias.s6 == null || RP?.sumatorias.s6 == null ? '—' : sgn(R.sumatorias.s6 - RP.sumatorias.s6, 1)}</td></>}
          </tr>
          <tr>
            <td>Σ8 pliegues<span className="u">mm</span></td>
            <td className="n">{fmt(R.sumatorias.s8, 1)}</td>
            {hasP && <><td className="n">{fmt(RP?.sumatorias.s8 ?? null, 1)}</td><td className="n">{R.sumatorias.s8 == null || RP?.sumatorias.s8 == null ? '—' : sgn(R.sumatorias.s8 - RP.sumatorias.s8, 1)}</td></>}
          </tr>
        </tbody>
      </table>
    )
    const perimetros: { k: 'brazo' | 'muslo' | 'pierna'; l: string; phantom: 'brazoCorregido' | 'musloCorregido' | 'piernaCorregida' }[] = [
      { k: 'brazo', l: 'Brazo', phantom: 'brazoCorregido' },
      { k: 'muslo', l: 'Muslo', phantom: 'musloCorregido' },
      { k: 'pierna', l: 'Pierna', phantom: 'piernaCorregida' },
    ]
    const musT = (
      <>
        <table>
          <thead>
            <tr><th>Perímetro corregido</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}{!esMenorConocido && <th className="n">Z-score (Phantom)</th>}</tr>
          </thead>
          <tbody>
            {perimetros.map((p) => {
              const a = R.corregidos[p.k], prevVal = RP?.corregidos[p.k] ?? null
              const z = esMenorConocido ? null : zPhantom(p.phantom, a, medidasCur.talla ?? null)
              return (
                <tr key={p.k}>
                  <td>{p.l}<span className="u">cm</span></td>
                  <td className="n">{fmt(a, 1)}</td>
                  {hasP && <><td className="n">{fmt(prevVal, 1)}</td><td className="n">{a == null || prevVal == null ? '—' : sgn(a - prevVal, 1)}</td></>}
                  {!esMenorConocido && <td className="n">{z == null ? '—' : sgn(z, 2)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="isak-note">Perímetro corregido = perímetro − π × pliegue (cm) del mismo segmento.</p>
      </>
    )
    PAGINAS.push({
      titulo: 'Índices', subtitulo: 'Relaciones entre tejidos, adiposidad y muscularidad',
      body: (
        <>
          {seccionIndices}
          <div><h3 className="isak-sub">Adiposidad</h3>{sumT}</div>
          <div><h3 className="isak-sub">Muscularidad</h3>{musT}</div>
        </>
      ),
    })
  }

  // ---------- P4: Proporcionalidad ósea ----------
  {
    // Córmico y envergadura relativa: `calcular()` ya devuelve `indices.cormico`/`envergaduraRelativa`
    // redondeados a 2 decimales (ver calculos.ts) — clasificar sobre ellos ya es clasificar sobre el
    // valor mostrado, sin cambios acá. Manouvrier es la excepción (ver más abajo).
    const filas = [
      { l: 'Índice córmico', f: 'Talla sentado / talla', a: R.indices.cormico, p: RP?.indices.cormico ?? null, d: 2, texto: R.indices.cormico != null ? TEXTOS_CORMICO[categoriaCormico(R.indices.cormico)] : null, ref: REFERENCIA_CORMICO, fuente: FUENTES.cormico },
      // Manouvrier: calcular() devuelve el valor crudo (no redondea, a diferencia de córmico/envergadura);
      // se clasifica sobre el valor redondeado que se muestra (Math.round, igual que el diseño), no el crudo.
      { l: 'Índice de Manouvrier', f: '(Talla − talla sentado) / talla sentado × 100', a: R.indices.manouvrier, p: RP?.indices.manouvrier ?? null, d: 0, texto: R.indices.manouvrier != null ? TEXTOS_MANOUVRIER[categoriaManouvrier(Math.round(R.indices.manouvrier))] : null, ref: REFERENCIA_MANOUVRIER, fuente: FUENTES.manouvrier },
      { l: 'Envergadura relativa', f: 'Envergadura / talla', a: R.indices.envergaduraRelativa, p: RP?.indices.envergaduraRelativa ?? null, d: 2, texto: R.indices.envergaduraRelativa != null ? TEXTOS_ENVERGADURA[categoriaEnvergadura(R.indices.envergaduraRelativa)] : null, ref: REFERENCIA_ENVERGADURA, fuente: null as string | null },
    ]
    PAGINAS.push({
      titulo: 'Proporcionalidad ósea', subtitulo: 'Relación entre segmentos corporales',
      body: (
        <>
          <table>
            <thead><tr><th>Índice</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}<th>Clasificación</th></tr></thead>
            <tbody>
              {filas.map((fl) => (
                <tr key={fl.l}>
                  <td><b>{fl.l}</b><span className="isak-falta" style={{ color: 'var(--muted)', fontWeight: 400 }}>{fl.f}</span></td>
                  <td className="n"><b>{fmt(fl.a, fl.d)}</b></td>
                  {hasP && <><td className="n">{fmt(fl.p, fl.d)}</td><td className="n">{fl.a == null || fl.p == null ? '—' : sgn(fl.a - fl.p, fl.d)}</td></>}
                  <td>{fl.texto ? `${fl.texto.etiqueta}${fl.texto.descripcion ? ` — ${fl.texto.descripcion}` : ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="isak-box">
            <div className="isak-bt">Referencias</div>
            {filas.map((fl) => (
              <p className="isak-note" style={{ margin: '3px 0' }} key={fl.l}><b style={{ color: 'var(--ink-2)' }}>{fl.l}:</b> {fl.ref}{fl.fuente && ` · Fuente: ${fl.fuente}`}</p>
            ))}
          </div>
        </>
      ),
    })
  }

  // ---------- P5: Somatotipo ----------
  {
    const comps: { k: 'endo' | 'meso' | 'ecto'; l: string; d: string }[] = [
      { k: 'endo', l: 'Endomorfia', d: 'Adiposidad relativa' },
      { k: 'meso', l: 'Mesomorfia', d: 'Robustez músculo-esquelética' },
      { k: 'ecto', l: 'Ectomorfia', d: 'Linealidad relativa' },
    ]
    const tablaComp = (
      <table>
        <thead><tr><th>Componente</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}<th>Lectura</th></tr></thead>
        <tbody>
          {comps.map((c) => {
            const v = R.somatotipo[c.k], pv = RP?.somatotipo[c.k] ?? null
            return (
              <tr key={c.k}>
                <td><b>{c.l}</b><span className="isak-falta" style={{ color: 'var(--muted)', fontWeight: 400 }}>{c.d}</span></td>
                <td className={`n${v == null ? ' miss' : ''}`}><b>{v == null ? '—' : fmt(v, 2)}</b></td>
                {hasP && <><td className="n">{fmt(pv, 2)}</td><td className="n">{v == null || pv == null ? '—' : sgn(v - pv, 2)}</td></>}
                <td>{v == null ? '—' : `${lecturaSomatotipo(v).charAt(0).toUpperCase()}${lecturaSomatotipo(v).slice(1)} — ${TEXTOS_SOMATOTIPO[c.k][lecturaSomatotipo(v)]}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
    const tablaXY = (
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>Coordenada</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}</tr></thead>
        <tbody>
          <tr>
            <td>X = ecto − endo</td>
            <td className="n">{fmt(R.somatotipo.x, 2)}</td>
            {hasP && <><td className="n">{fmt(RP?.somatotipo.x ?? null, 2)}</td><td className="n">{R.somatotipo.x == null || RP?.somatotipo.x == null ? '—' : sgn(R.somatotipo.x - RP.somatotipo.x, 2)}</td></>}
          </tr>
          <tr>
            <td>Y = 2·meso − (endo + ecto)</td>
            <td className="n">{fmt(R.somatotipo.y, 2)}</td>
            {hasP && <><td className="n">{fmt(RP?.somatotipo.y ?? null, 2)}</td><td className="n">{R.somatotipo.y == null || RP?.somatotipo.y == null ? '—' : sgn(R.somatotipo.y - RP.somatotipo.y, 2)}</td></>}
          </tr>
        </tbody>
      </table>
    )
    const legOld = hayMasDeDosControles ? (
      <>
        <span><i className="isak-sym-o" />Controles anteriores</span>
        <span><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#8A93A1" strokeWidth={1.3} strokeDasharray="4 3" /></svg>Trayectoria</span>
      </>
    ) : null
    PAGINAS.push({
      titulo: 'Somatotipo', subtitulo: 'Heath-Carter',
      body: (
        <>
          <div className="isak-soma">
            <div>
              {tablaComp}
              {tablaXY}
              <p className="isak-note">Somatotipo antropométrico de Heath-Carter. Lectura: bajo hasta 2,5 · moderado hasta 4,5 · alto hasta 6,5 · muy alto hasta 8,5 · extremadamente alto más de 8,5. {ACLARACION_ESCALA_SOMATOTIPO}</p>
              <p className="isak-note">Fuente: {FUENTES.somatotipo}</p>
              {R.somatotipo.x == null && <div className="isak-info" style={{ marginTop: 8 }}>El punto actual no se grafica hasta completar las medidas de mesomorfia.</div>}
            </div>
            <div className="isak-box">
              <div dangerouslySetInnerHTML={{ __html: somatochart(puntosSomatocarta, { w: 210 }) }} />
              <div className="isak-chart-leg">
                <span><i className="isak-sym-a" />Actual</span>
                {hasP && <span><i className="isak-sym-p" />Previo</span>}
                {legOld}
              </div>
            </div>
          </div>
          {hayMasDeDosControles && (
            <div>
              <h3 className="isak-sub">Controles graficados</h3>
              <table>
                <thead><tr><th>Evaluación</th><th>Fecha</th><th className="n">Endo</th><th className="n">Meso</th><th className="n">Ecto</th></tr></thead>
                <tbody>
                  {historicos.map(({ r, resultado, kind }, i) => (
                    <tr key={r.id}>
                      <td>Nº {i + 1}{kind === 'actual' ? ' · actual' : kind === 'previo' ? ' · previo' : ''}</td>
                      <td>{fmtFecha(r.fecha)}</td>
                      <td className="n">{fmt(resultado.somatotipo.endo, 2)}</td>
                      <td className="n">{resultado.somatotipo.meso == null ? '—' : fmt(resultado.somatotipo.meso, 2)}</td>
                      <td className="n">{fmt(resultado.somatotipo.ecto, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ),
    })
  }

  // ---------- P6: Índices de salud ----------
  {
    const avisoSexo = avisoFaltante(sexo, edad, { sexo: true })
    const avisoEdad = avisoFaltante(sexo, edad, { edad: true })
    const iccC = sexo ? CORTES_SALUD.cinturaCadera[sexo] : null
    const conC = sexo ? CORTES_CONICIDAD_POR_SEXO[sexo] : null
    const catConicidad = categoriaConicidad(sexo, R.salud.conicidad)
    const imcInterp = esMenorConocido
      ? 'Clasificación no aplicable en menores de 18 años: usar IMC para la edad (OMS).'
      : edadDesconocida ? avisoEdad
      : R.salud.imcClasificacion === 'bajo' ? 'Por debajo del rango de referencia (bajo peso, OMS).'
      : R.salud.imcClasificacion === 'normal' ? 'Dentro del rango de referencia.'
      : R.salud.imcClasificacion === 'sobrepeso' ? 'Por encima del rango de referencia (sobrepeso, OMS). No distingue masa adiposa de muscular: leer junto con la composición tisular.'
      : R.salud.imcClasificacion === 'obesidad' ? 'Por encima del rango de referencia (obesidad, OMS).'
      : '—'
    const cutText = (v: number | null, c: number | null) => v == null || c == null ? '—' : v < c ? 'Por debajo del punto de corte de riesgo cardiometabólico.' : 'En o por encima del punto de corte de riesgo cardiometabólico.'
    const filas = [
      { l: 'IMC', u: 'kg/m²', a: R.salud.imc, p: RP?.salud.imc ?? null, d: 1, ref: esMenorConocido ? '—' : '18,5 – 24,9', interp: imcInterp },
      { l: 'Cintura / cadera', u: '', a: R.salud.cinturaCadera, p: RP?.salud.cinturaCadera ?? null, d: 2, ref: iccC != null ? `< ${fmt(iccC, 2)} (${sexo === 'M' ? 'hombres' : 'mujeres'})` : avisoSexo, interp: iccC != null ? cutText(R.salud.cinturaCadera, iccC) : avisoSexo },
      { l: 'Cintura / talla', u: '', a: R.salud.cinturaTalla, p: RP?.salud.cinturaTalla ?? null, d: 2, ref: '< 0,50', interp: cutText(R.salud.cinturaTalla, CORTES_SALUD.cinturaTalla) },
      { l: 'Índice de conicidad', u: '', a: R.salud.conicidad, p: RP?.salud.conicidad ?? null, d: 2, ref: conC != null ? `< ${fmt(conC, 2)} (${sexo === 'M' ? 'hombres' : 'mujeres'})` : avisoSexo, interp: conC != null ? (catConicidad === 'normal' ? 'Por debajo del punto de corte de riesgo cardiometabólico.' : 'En o por encima del punto de corte de riesgo cardiometabólico.') : avisoSexo },
    ]
    PAGINAS.push({
      titulo: 'Índices de salud', subtitulo: 'Indicadores de riesgo',
      body: (
        <>
          <table>
            <thead><tr><th>Índice</th><th className="n">Actual</th>{hasP && <><th className="n">Previo</th><th className="n">Diferencia</th></>}<th>Referencia</th><th style={{ width: '38%' }}>Interpretación</th></tr></thead>
            <tbody>
              {filas.map((fl) => (
                <tr key={fl.l}>
                  <td><b>{fl.l}</b>{fl.u && <span className="u">{fl.u}</span>}</td>
                  <td className="n"><b>{fmt(fl.a, fl.d)}</b></td>
                  {hasP && <><td className="n">{fmt(fl.p, fl.d)}</td><td className="n">{fl.a == null || fl.p == null ? '—' : sgn(fl.a - fl.p, fl.d)}</td></>}
                  <td>{fl.ref}</td>
                  <td>{fl.interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="isak-note">Fuente: IMC, {FUENTES.imc} · Cintura/cadera, {FUENTES.cinturaCaderaOms} · Conicidad, {FUENTES.conicidad}</p>
          <p className="isak-foot-note">Los índices de salud son orientativos, no reemplazan la evaluación clínica.</p>
        </>
      ),
    })
  }

  const N = PAGINAS.length
  const desdeAnteriorTexto = prev ? `${dias(prev.fecha, cur.fecha)} días` : 'Primera evaluación'

  return (
    <div className="isak-root">
      <div className="isak-toolbar">
        <a href={`/pacientes/${params.id}`}>
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={1.8} fill="none" /></svg>
          Ficha de {paciente.nombre} {paciente.apellido}
        </a>
        <span className="isak-sp" />
        <ImprimirButton />
      </div>
      <main className="isak-pages">
        {PAGINAS.map((p, i) => (
          <section className="isak-page" key={p.titulo}>
            <header className="isak-ph">
              <div className="isak-ph-top">
                <div>
                  <div className="isak-ph-t">Informe antropométrico</div>
                  <div className="isak-ph-pro">{nombreProfesional}</div>
                </div>
                <div className="isak-ph-meta">
                  <div><span className="isak-lb">Protocolo de medición</span><b>{protocolo}</b></div>
                </div>
              </div>
              <div className="isak-ph-pac">
                <div><span className="isak-lb">Paciente</span><b>{paciente.nombre} {paciente.apellido}</b></div>
                <div><span className="isak-lb">Edad</span><b>{edad != null ? `${edad} años` : '—'}</b></div>
                <div><span className="isak-lb">Sexo</span><b>{sexoLabel}</b></div>
                <div><span className="isak-lb">Fecha</span><b>{fmtFecha(cur.fecha)}</b></div>
                <div><span className="isak-lb">Evaluación</span><b>Nº {numeroEvaluacion}</b></div>
                <div><span className="isak-lb">Desde la anterior</span><b>{desdeAnteriorTexto}</b></div>
              </div>
              <div className="isak-ph-leg">
                <span><i className="isak-sym-a" />Actual <b>{fmtFecha(cur.fecha)}</b></span>
                {prev && <span><i className="isak-sym-p" />Previo <b>{fmtFecha(prev.fecha)}</b></span>}
              </div>
            </header>
            <div className="isak-pb">
              <h2 className="isak-sec">{i + 1} · {p.titulo}<span>{p.subtitulo}</span></h2>
              {p.body}
            </div>
            <footer className="isak-pf">
              <span><b>{nombreProfesional}</b> · {profile?.email}</span>
              <span>Página {i + 1} de {N}</span>
            </footer>
          </section>
        ))}
      </main>
    </div>
  )
}
