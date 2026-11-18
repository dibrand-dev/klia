import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { differenceInYears, parseISO } from 'date-fns'
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { serviceClient } from '@/lib/supabase/service'
import {
  calcular, medidasDesdeRegistro, fmt, sgn, fecha as fmtFecha, somatochart,
  lecturaSomatotipo, categoriaCormico, categoriaManouvrier, categoriaEnvergadura, categoriaCinturaCadera,
  CORTES_CONICIDAD_POR_SEXO, CORTE_OMS_CINTURA_CADERA, TABLA_CINTURA_CADERA,
  TEXTOS_SOMATOTIPO, TEXTOS_CORMICO, TEXTOS_MANOUVRIER, TEXTOS_ENVERGADURA, FUENTES,
  compararIgual, urlSocialSegura, etiquetaCategoriaCinturaCadera, porcentajesTejidos,
  type Paciente as PacienteCalculo, type Sexo,
} from '@/lib/antropometria'
import type { RegistroAntropometrico } from '@/types/database'
import BotonImprimir from './BotonImprimir'
import './informe-publico.css'

export const metadata: Metadata = {
  title: 'Tu evaluación antropométrica',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export const dynamic = 'force-dynamic'

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DEC_LABEL = ['20–29', '30–39', '40–49', '50–59', '60–69']
const RISK_LABEL = ['Bajo', 'Moderado', 'Alto', 'Muy alto']
const QS: Record<string, string> = {
  masa: 'Es tu peso total: suma grasa, músculo, hueso, órganos y agua. Por sí solo no dice de qué está hecho el cambio.',
  s6: 'Mide el espesor de la grasa que está debajo de la piel en 6 puntos del cuerpo. Si baja, tenés menos grasa.',
  pCintura: 'Refleja la grasa acumulada en el abdomen, la que más se relaciona con la salud del corazón.',
  pCadera: 'Incluye grasa y músculo de los glúteos. Se lee junto con la cintura.',
  pBrazoC: 'Con el brazo en fuerza, refleja sobre todo el músculo del brazo.',
  pMuslo: 'Combina el músculo y la grasa del muslo.',
  pPierna: 'Refleja principalmente el músculo de la pantorrilla.',
  adi: 'Es la grasa total del cuerpo, no solo la que se ve.',
  mus: 'Es el músculo total. Mantenerlo o aumentarlo es una buena señal.',
}
const SOMA_DEF: { k: 'endo' | 'meso' | 'ecto'; n: string; par: string }[] = [
  { k: 'endo', n: 'Endomorfia', par: 'adiposidad relativa' },
  { k: 'meso', n: 'Mesomorfia', par: 'desarrollo músculo-esquelético' },
  { k: 'ecto', n: 'Ectomorfia', par: 'linealidad relativa' },
]
const FALTA = { sexo: 'Falta cargar el sexo para calcular este indicador.', edad: 'Falta cargar la fecha de nacimiento para calcular este indicador.' }
const FALTA2 = { sexo: 'Falta cargar el sexo para clasificar este indicador.', edad: 'Falta cargar la fecha de nacimiento para clasificar este indicador.' }
const MISS_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
const ICON_I = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
const ICON_CONF = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x={4} y={10.5} width={16} height={10.5} rx={2} /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
const SOC_ORDEN = ['instagram', 'facebook', 'x', 'tiktok', 'linkedin'] as const
const SOC_NOMBRE: Record<(typeof SOC_ORDEN)[number], string> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', tiktok: 'TikTok', linkedin: 'LinkedIn' }
const SOC_ICON: Record<(typeof SOC_ORDEN)[number], React.ReactNode> = {
  instagram: <><rect x={3} y={3} width={18} height={18} rx={5} /><circle cx={12} cy={12} r={4} /><path d="M17.5 6.5h.01" /></>,
  facebook: <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l.5-4H12V7.5c0-.6.4-1 1-1h2z" />,
  x: <><path d="M4 4l11.7 16H20L8.3 4z" /><path d="M4 20l6.8-6.8M20 4l-6.6 6.6" /></>,
  tiktok: <><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.3 4.4 5 4.6" /></>,
  linkedin: <><rect x={3} y={3} width={18} height={18} rx={3} /><path d="M8 10.5V17M8 7.2v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17" /></>,
}

function mes(iso: string): string { return MES[Number(iso.split('-')[1]) - 1] }
function largo(iso: string): string { const [y, m, d] = iso.split('-'); return `${+d} de ${MES[Number(m) - 1]} de ${y}` }
function formatMatricula(tipo: string | null, matricula: string | null, provincia: string | null): string {
  if (!matricula) return ''
  const m = matricula.trim()
  if (tipo === 'provincial') {
    const base = m.toUpperCase().startsWith('MP') ? m : `MP ${m}`
    return `${base}${provincia ? ` (${provincia})` : ''}`
  }
  if (tipo === 'nacional') return m.toUpperCase().startsWith('MN') ? m : `MN ${m}`
  return m
}
function iniciales(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}
// 'AR' como país default — mismo criterio que SlideOverCompartirPlan.tsx /
// SlideOverCompartirAntropometria.tsx: no guardamos el país del profesional.
function telefonoWhatsappValido(telefono: string | null): string | null {
  if (!telefono) return null
  const numero = parsePhoneNumberFromString(telefono, 'AR')
  if (!numero || !numero.isValid()) return null
  return numero.number
}
/** Formato internacional legible para mostrar (no para el link de wa.me). Si no es un
 * número válido, se muestra tal cual está guardado. */
function telefonoDisplay(telefono: string | null): string | null {
  if (!telefono) return null
  const numero = parsePhoneNumberFromString(telefono, 'AR')
  if (!numero || !numero.isValid()) return telefono
  return numero.formatInternational()
}
function dtxt(d: number, u: string, dec: number, pm: string): React.ReactNode {
  const r = Number(d.toFixed(dec))
  if (r === 0) return <>Igual que en {pm}</>
  return <><b>{fmt(Math.abs(r), dec)} {u}</b> {r < 0 ? 'menos' : 'más'} que en {pm}</>
}

export default async function InformeAntropometriaPublicoPage({ params }: { params: { token: string } }) {
  const db = serviceClient()

  const { data: share } = await db
    .from('antropometria_compartidos')
    .select('paciente_id, terapeuta_id, vence_en, revocado_en')
    .eq('token', params.token)
    .maybeSingle()

  const vencido = !!share?.vence_en && new Date(share.vence_en) <= new Date()
  if (!share || share.revocado_en || vencido) notFound()

  const [{ data: paciente }, { data: profile }, { data: registrosData }] = await Promise.all([
    db.from('pacientes').select('nombre, genero, fecha_nacimiento').eq('id', share.paciente_id).maybeSingle(),
    db
      .from('profiles')
      .select('nombre, apellido, especialidad, matricula, matricula_tipo, matricula_provincia, antropometria_certificacion, email, telefono, avatar_url, estado_cuenta, instagram_url, facebook_url, x_url, tiktok_url, linkedin_url')
      .eq('id', share.terapeuta_id)
      .maybeSingle(),
    db
      .from('registros_antropometricos')
      .select('*')
      .eq('paciente_id', share.paciente_id)
      .eq('terapeuta_id', share.terapeuta_id)
      .eq('metodo_medicion', 'isak')
      .order('fecha', { ascending: true }),
  ])

  if (!paciente || !profile) notFound()
  if (profile.estado_cuenta === 'bloqueada') notFound()

  const registros = (registrosData ?? []) as RegistroAntropometrico[]
  if (registros.length === 0) notFound()

  const cur = registros[registros.length - 1]
  const anteriores = registros.filter((r) => r.fecha < cur.fecha)
  const prev = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null
  const hasP = !!prev

  const sexo: Sexo | null = paciente.genero === 'M' || paciente.genero === 'F' ? paciente.genero : null
  const edad = paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) : null
  const pac: PacienteCalculo = { sexo, edad }

  const medidasCur = medidasDesdeRegistro(cur)
  const R = calcular(medidasCur, pac)
  const RP = prev ? calcular(medidasDesdeRegistro(prev), pac) : null
  const medidasPrev = prev ? medidasDesdeRegistro(prev) : null

  const esMenorConocido = edad !== null && !R.esAdulto
  const showTis = !esMenorConocido && sexo !== null && edad !== null
  const tejidos = R.tejidos

  const pm = prev ? mes(prev.fecha) : ''
  const pmTxt = prev ? (prev.fecha.slice(0, 4) !== cur.fecha.slice(0, 4) ? `${pm} de ${prev.fecha.slice(0, 4)}` : pm) : ''

  const profesionalNombreCorto = `${profile.nombre} ${profile.apellido}`
  const matriculaTxt = formatMatricula(profile.matricula_tipo, profile.matricula, profile.matricula_provincia)
  const telefonoE164 = telefonoWhatsappValido(profile.telefono)

  const redesConValor = SOC_ORDEN
    .map((k) => ({ net: k, url: urlSocialSegura(profile[`${k}_url` as const]) }))
    .filter((r): r is { net: (typeof SOC_ORDEN)[number]; url: string } => !!r.url)

  // ---------- KPIs (cover) ----------
  const k3: [string, number | null, number | null, string, number][] = [
    ['Peso', medidasCur.masa ?? null, medidasPrev?.masa ?? null, 'kg', 1],
    ['Suma de pliegues', R.sumatorias.s6, RP?.sumatorias.s6 ?? null, 'mm', 0],
    ['Cintura', medidasCur.cintura ?? null, medidasPrev?.cintura ?? null, 'cm', 1],
  ]

  // ---------- "Qué cambió" ----------
  const rows: [string, string, number | null, number | null, string, number][] = [
    ['Peso', 'masa', medidasCur.masa ?? null, medidasPrev?.masa ?? null, 'kg', 1],
    ['Suma de 6 pliegues', 's6', R.sumatorias.s6, RP?.sumatorias.s6 ?? null, 'mm', 0],
    ['Suma de 8 pliegues', 's8', R.sumatorias.s8, RP?.sumatorias.s8 ?? null, 'mm', 0],
    ['Cintura', 'pCintura', medidasCur.cintura ?? null, medidasPrev?.cintura ?? null, 'cm', 1],
    ['Cadera', 'pCadera', medidasCur.cadera ?? null, medidasPrev?.cadera ?? null, 'cm', 1],
    ['Brazo contraído', 'pBrazoC', medidasCur.brazoContraido ?? null, medidasPrev?.brazoContraido ?? null, 'cm', 1],
    ['Muslo', 'pMuslo', medidasCur.musloMedio ?? null, medidasPrev?.musloMedio ?? null, 'cm', 1],
    ['Pantorrilla', 'pPierna', medidasCur.pierna ?? null, medidasPrev?.pierna ?? null, 'cm', 1],
  ]
  if (showTis && tejidos) {
    rows.push(
      ['Grasa', 'adi', tejidos.adiposo, prev && RP ? RP.tejidos?.adiposo ?? null : null, 'kg', 1],
      ['Músculo', 'mus', tejidos.muscular, prev && RP ? RP.tejidos?.muscular ?? null : null, 'kg', 1],
    )
  }

  // ---------- Fraccionamiento tisular ----------
  let tisSec: React.ReactNode = null
  if (!esMenorConocido) {
    if (showTis && tejidos && tejidos.adiposo != null && tejidos.muscular != null && tejidos.oseo != null) {
      const pct = porcentajesTejidos(tejidos, 0)!
      const prevTej = RP?.tejidos
      tisSec = (
        <section className="blk keep pad">
          <h2>Fraccionamiento tisular</h2>
          <p className="sub">Proporción entre el tejido adiposo, el muscular y el óseo.</p>
          <div className="comp">
            <div className="mbar" role="img" aria-label={`Adiposo ${pct.adiposo}%, muscular ${pct.muscular}%, óseo ${pct.oseo}%`}>
              <span style={{ width: `${pct.adiposo}%`, background: '#3F519E' }}>{pct.adiposo} %</span>
              <span style={{ width: `${pct.muscular}%`, background: '#7D8AC4' }}>{pct.muscular} %</span>
              <span className="dk" style={{ width: `${pct.oseo}%`, background: '#C6CCE5' }}>{pct.oseo} %</span>
            </div>
            <div className="mlist">
              <div className="m"><span className="sw" style={{ background: '#3F519E' }} /><div className="nm2">Adiposo<small>Reserva de energía del cuerpo. Una parte es necesaria; el exceso, sobre todo en el abdomen, es el que conviene bajar.</small></div><span className="gr">{fmt(tejidos.adiposo, 1)} kg{hasP && prevTej?.adiposo != null && <small>{sgn(tejidos.adiposo - prevTej.adiposo, 1)} kg</small>}</span></div>
              <div className="m"><span className="sw" style={{ background: '#7D8AC4' }} /><div className="nm2">Muscular<small>Te da fuerza y movimiento, y gasta energía aun en reposo. Conviene mantenerlo o aumentarlo.</small></div><span className="gr">{fmt(tejidos.muscular, 1)} kg{hasP && prevTej?.muscular != null && <small>{sgn(tejidos.muscular - prevTej.muscular, 1)} kg</small>}</span></div>
              <div className="m"><span className="sw" style={{ background: '#C6CCE5' }} /><div className="nm2">Óseo<small>Es la estructura de tu cuerpo. En adultos casi no cambia entre controles.</small></div><span className="gr">{fmt(tejidos.oseo, 1)} kg{hasP && prevTej?.oseo != null && <small>{sgn(tejidos.oseo - prevTej.oseo, 1)} kg</small>}</span></div>
            </div>
          </div>
          <p className="src">Fuente: Adiposo, {FUENTES.tejidoAdiposo} · Muscular, {FUENTES.tejidoMuscular} · Óseo, {FUENTES.tejidoOseo}</p>
        </section>
      )
    } else {
      tisSec = (
        <section className="blk keep pad">
          <h2>Fraccionamiento tisular</h2>
          <div className="hlt">
            <div style={{ gridColumn: '1/-1' }}>
              <div className="h miss wide">
                <div className="row"><span className="nm">Falta: Adiposo, muscular y óseo</span></div>
                <p>{MISS_ICON}<span>{sexo ? FALTA.edad : FALTA.sexo}</span></p>
              </div>
            </div>
          </div>
        </section>
      )
    }
  }

  // ---------- Proporciones ----------
  const corm = R.indices.cormico
  const manu = R.indices.manouvrier
  const envRel = R.indices.envergaduraRelativa
  const textoCormico = corm != null ? TEXTOS_CORMICO[categoriaCormico(corm)] : null
  const textoManouvrier = manu != null ? TEXTOS_MANOUVRIER[categoriaManouvrier(Math.round(manu))] : null
  const textoEnvergadura = envRel != null ? TEXTOS_ENVERGADURA[categoriaEnvergadura(envRel)] : null
  const propDef: { n: string; v: string; tx: string; l: string | null; d: string | null }[] = [
    { n: 'Índice córmico', v: fmt(corm, 2), tx: 'Compara la altura de tu tronco, sentado, con tu altura total.', l: textoCormico?.etiqueta ?? null, d: textoCormico?.descripcion ?? null },
    { n: 'Índice de Manouvrier', v: fmt(manu, 0), tx: 'Compara el largo de tus piernas con el de tu tronco.', l: textoManouvrier?.descripcion ?? null, d: null },
    { n: 'Envergadura relativa', v: fmt(envRel, 2), tx: 'Compara la distancia entre las puntas de tus dedos, con los brazos abiertos, con tu altura.', l: textoEnvergadura?.etiqueta ?? null, d: null },
  ]

  // ---------- Indicadores de salud ----------
  const iccTx = 'Compara la cintura con la cadera. Indica cómo se distribuye la grasa en tu cuerpo.'
  const salud: { nm: string; v: string; rf: string | null; tx: string; src: string | null; extra?: React.ReactNode; wide?: boolean; av?: string | null }[] = []

  if (!esMenorConocido) {
    salud.push({
      nm: 'Índice de masa corporal (IMC)', v: fmt(R.salud.imc, 1),
      rf: edad == null ? null : 'Referencia 18,5 a 24,9',
      tx: 'Relaciona tu peso con tu altura. No distingue grasa de músculo, por eso se mira junto con el resto del informe.',
      src: FUENTES.imc, av: edad == null ? FALTA2.edad : null,
    })
  }

  salud.push({
    nm: 'Cintura / altura', v: fmt(R.salud.cinturaTalla, 2),
    rf: esMenorConocido ? 'Sin clasificar' : 'Referencia menor a 0,50',
    tx: esMenorConocido ? 'Compara tu cintura con tu altura.' : 'Tu cintura debería medir menos de la mitad de tu altura.',
    src: null,
  })

  if (esMenorConocido) {
    salud.push({ nm: 'Cintura / cadera', v: fmt(R.salud.cinturaCadera, 2), rf: 'Sin clasificar', tx: iccTx, src: null, wide: true })
  } else if (!sexo || edad == null) {
    salud.push({ nm: 'Cintura / cadera', v: fmt(R.salud.cinturaCadera, 2), rf: null, tx: iccTx, src: null, wide: true, av: !sexo ? FALTA2.sexo : FALTA2.edad })
  } else if (edad >= 20 && edad <= 69) {
    const resultado = categoriaCinturaCadera(sexo, edad, R.salud.cinturaCadera as number)
    if (resultado) {
      const di = Math.floor(edad / 10) - 2
      const niveles = ['bajo', 'moderado', 'alto', 'muy_alto'] as const
      const lv = niveles.indexOf(resultado.categoria)
      salud.push({
        nm: 'Cintura / cadera', v: fmt(R.salud.cinturaCadera, 2),
        rf: `Nivel de riesgo: ${etiquetaCategoriaCinturaCadera(resultado.categoria).toLowerCase()}`,
        tx: `${iccTx} La tabla es para ${sexo === 'F' ? 'mujeres' : 'hombres'}; tu fila está resaltada.`,
        src: null, wide: true,
        extra: <TablaIccPorDecada sexo={sexo} decadaIdx={di} nivelIdx={lv} />,
      })
    }
  } else {
    salud.push({
      nm: 'Cintura / cadera', v: fmt(R.salud.cinturaCadera, 2),
      rf: `Referencia menor a ${fmt(CORTE_OMS_CINTURA_CADERA[sexo], 2)}`,
      tx: iccTx, src: FUENTES.cinturaCaderaOms, wide: true,
    })
  }

  if (!esMenorConocido) {
    salud.push({
      nm: 'Índice de conicidad', v: fmt(R.salud.conicidad, 2),
      rf: sexo ? `Referencia menor a ${fmt(CORTES_CONICIDAD_POR_SEXO[sexo], 2)}` : null,
      tx: 'Estima cuánta grasa se concentra en el abdomen según tu peso y altura.',
      src: FUENTES.conicidad, wide: true, av: sexo ? null : FALTA2.sexo,
    })
  }

  // ---------- Somatocarta ----------
  const historicos = registros.map((r) => ({ r, resultado: r.id === cur.id ? R : calcular(medidasDesdeRegistro(r), pac) }))
  const puntos = historicos.map(({ r, resultado }) =>
    resultado.somatotipo.x != null && resultado.somatotipo.y != null
      ? { x: resultado.somatotipo.x, y: resultado.somatotipo.y, kind: (r.id === cur.id ? 'actual' : r.id === prev?.id ? 'previo' : 'historico') as 'actual' | 'previo' | 'historico' }
      : null,
  )
  const hayMasDeUnPrevio = hasP && registros.length > 2

  return (
    <div className="ap-root">
      <div className="sheet">
        <header className="top pad">
          <div className="who">
            <span className="mark">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : (
                <span className="fallback">{iniciales(profile.nombre, profile.apellido)}</span>
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{profesionalNombreCorto}</div>
              <div className="mn">{profile.especialidad}{matriculaTxt ? ` · ${matriculaTxt}` : ''}</div>
            </div>
          </div>
          <BotonImprimir />
        </header>

        <section className="cover pad">
          <p className="eyebrow">Evaluación antropométrica</p>
          <h1 className="title">Hola, {paciente.nombre}.<br /><span className="ac">{hasP ? 'Así cambiaron tus medidas' : 'Estas son tus medidas'}</span></h1>
          <p className="sub">Control del {largo(cur.fecha)}{hasP ? `, comparado con el del ${largo(prev!.fecha)}` : ''}.</p>
          <div className="kpis">
            {k3.map(([l, a, p, u, d]) => (
              <div className="kpi" key={l}>
                <span className="lbl">{l}</span>
                <span className="v">{fmt(a, d)}<small>{u}</small></span>
                {p != null && a != null && <span className="d">{dtxt(a - p, u, d, pm)}</span>}
              </div>
            ))}
          </div>
          {!hasP && <p className="first">Todavía no hay un control anterior para comparar.</p>}
          {esMenorConocido && (
            <p className="minor">{ICON_I}<span><b>Para menores de 18 años se usan otras tablas de referencia; consultá con tu profesional.</b></span></p>
          )}
        </section>

        <section className="blk pad">
          <h2>{hasP ? 'Qué cambió' : 'Tus medidas'}</h2>
          <p className="sub">{hasP ? `Cada medida de ${largo(prev!.fecha).replace(/ de \d+$/, '')} frente a la de hoy, y qué te dice.` : 'Cada medida y qué te dice.'}</p>
          <div className={`chg${hasP ? '' : ' nop'}`}>
            <div className="chg-h"><span>Medida</span>{hasP && <span>Anterior</span>}<span>Actual</span>{hasP && <span>Diferencia</span>}</div>
            {rows.map(([l, k, a, p, u, d]) => (
              <div className="chg-r" key={k}>
                <span className="nm">{l}</span>
                {hasP && <span className="n" data-k="Anterior">{fmt(p, d)} {u}</span>}
                <span className="n a" data-k="Actual">{fmt(a, d)} {u}</span>
                {hasP && <span className="n" data-k="Diferencia">{a == null || p == null ? '—' : sgn(a - p, d)} {u}</span>}
                {QS[k] && <p className="qs"><b>¿Qué significa?</b> {QS[k]}</p>}
              </div>
            ))}
          </div>
        </section>

        {tisSec}

        <section className="blk keep pad">
          <h2>Proporciones de tu cuerpo</h2>
          <p className="sub">{esMenorConocido ? 'Cada valor, sin clasificar.' : 'Cómo se reparten las medidas entre tronco, piernas y brazos.'}</p>
          <div className="prop">
            {propDef.map((p) => (
              <div className="pr" key={p.n}>
                <span className="nm">{p.n}</span>
                <span className="v">{p.v}</span>
                <p className="tx">{p.tx}</p>
                {!esMenorConocido && p.l && (
                  <div className="cl"><span className="pill">{p.l}</span>{p.d && <span className="d">{p.d}</span>}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="blk keep pad">
          <h2>Tu forma corporal</h2>
          <p className="sub">El somatotipo describe tu forma con tres valores. No es bueno ni malo: muestra hacia dónde se inclina tu cuerpo y cómo se mueve con el tiempo.</p>
          <div className="soma">
            <div>
              <div className="sr">
                {SOMA_DEF.map((s) => {
                  const v = R.somatotipo[s.k]
                  const pv = RP?.somatotipo[s.k] ?? null
                  const nivel = v != null ? lecturaSomatotipo(v) : null
                  return (
                    <div className="r" key={s.k}>
                      <div className="rh">
                        <div className="nm">{s.n}<small>{s.par}</small></div>
                        <span className="v">{fmt(v, 1)}</span>
                      </div>
                      {!esMenorConocido && nivel && (
                        <>
                          <span className="lv">{nivel.charAt(0).toUpperCase()}{nivel.slice(1)}</span>
                          <p className="t">{TEXTOS_SOMATOTIPO[s.k][nivel]}</p>
                        </>
                      )}
                      {hasP && v != null && pv != null && (
                        <p className="ev">
                          Desde {pmTxt}, tu {s.n.toLowerCase()} ({s.par}) {compararIgual(v, pv) ? <>se mantuvo igual en {fmt(v, 1)}.</> : <>{v < pv ? 'bajó' : 'subió'} de {fmt(pv, 1)} a <b>{fmt(v, 1)}</b>.</>}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="snote"><b>Son valores de una escala, no porcentajes ni kilos.</b>{!esMenorConocido && ' Niveles: bajo hasta 2,5 · moderado hasta 4,5 · alto hasta 6,5 · muy alto hasta 8,5 · extremadamente alto más de 8,5.'}</p>
            </div>
            <div>
              <div dangerouslySetInnerHTML={{ __html: somatochart(puntos, {
                w: 250, ink: '#0E1430', muted: '#8A90A8', line: '#E5E7EF', grid: '#F1F2F7', prev: '#8A90A8', old: '#B9BED0', font: 'Inter,sans-serif',
                labels: { endo: 'ENDOMORFIA', meso: 'MESOMORFIA', ecto: 'ECTOMORFIA' },
              }) }} />
              <div className="cleg">
                <span><i className="sa" />Hoy</span>
                {hasP && <span><i className="sp" />{pmTxt.charAt(0).toUpperCase()}{pmTxt.slice(1)}</span>}
                {hayMasDeUnPrevio && <span><i className="so" />Antes</span>}
              </div>
            </div>
            {hasP && (
              <div className="hist">
                <h3>Historial de controles</h3>
                <div className="hrow hh"><span>Fecha</span><span>Peso</span><span>Endo</span><span>Meso</span><span>Ecto</span></div>
                {historicos.slice().reverse().map(({ r, resultado }) => (
                  <div className={`hrow${r.id === cur.id ? ' cur' : ''}`} key={r.id}>
                    <span>{fmtFecha(r.fecha)}</span>
                    <span>{fmt(r.peso, 1)} kg</span>
                    <span>{fmt(resultado.somatotipo.endo, 1)}</span>
                    <span>{fmt(resultado.somatotipo.meso, 1)}</span>
                    <span>{fmt(resultado.somatotipo.ecto, 1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="src">Fuente: {FUENTES.somatotipo}</p>
        </section>

        <section className="blk keep pad">
          <h2>Indicadores de salud</h2>
          <p className="sub">{esMenorConocido ? 'Cada valor, sin clasificar.' : 'Cada valor con su rango de referencia.'}</p>
          <div className="hlt">
            {salud.map((c) => (
              <div className={`h${c.wide ? ' wide' : ''}`} key={c.nm}>
                <div className="row"><span className="nm">{c.nm}</span><span className="v">{c.v}</span></div>
                {c.rf && <span className="rf">{c.rf}</span>}
                {c.av && <span className="av">{MISS_ICON}<span>{c.av}</span></span>}
                <p>{c.tx}</p>
                {c.extra}
                {c.src && <p className="src">{c.src}</p>}
              </div>
            ))}
          </div>
          <p className="warn">{ICON_I}<span><b>Los índices son orientativos, no reemplazan la evaluación clínica.</b></span></p>
        </section>

        <section className="close pad">
          <p className="eyebrow">Cierre</p>
          <h2>Contacto</h2>
          <div className="contact">
            <dl>
              <div><dt>Profesional</dt><dd>{profesionalNombreCorto}</dd></div>
              <div><dt>Especialidad</dt><dd>{profile.especialidad}{profile.antropometria_certificacion ? ` · Antropometrista ${profile.antropometria_certificacion}` : ''}</dd></div>
              <div><dt>Matrícula</dt><dd>{matriculaTxt || '—'}</dd></div>
            </dl>
            <dl>
              {profile.telefono && (
                <div><dt>Teléfono / WhatsApp</dt><dd><a href={telefonoE164 ? `https://wa.me/${telefonoE164.replace('+', '')}` : undefined}>{telefonoDisplay(profile.telefono)}</a></dd></div>
              )}
              {profile.email && <div><dt>Email</dt><dd><a href={`mailto:${profile.email}`}>{profile.email}</a></dd></div>}
            </dl>
            {redesConValor.length > 0 && (
              <div className="soc">
                <dt>Redes sociales</dt>
                <ul>
                  {redesConValor.map(({ net, url }) => (
                    <li key={net}>
                      <a href={url} target="_blank" rel="noopener noreferrer" title={SOC_NOMBRE[net]} aria-label={`${SOC_NOMBRE[net]} de ${profesionalNombreCorto} (se abre en otra pestaña)`}>
                        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">{SOC_ICON[net]}</svg>
                        <span className="h2">{SOC_NOMBRE[net]}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="proto">Protocolo de medición: <b>ISAK</b></p>
          <p className="conf">{ICON_CONF}<span><b>Confidencialidad.</b> Este informe es de uso personal del paciente mencionado. Contiene datos de salud protegidos por la Ley 25.326 de Protección de Datos Personales.</span></p>
        </section>
        <footer className="foot pad">
          <span>Evaluación antropométrica · Documento de uso personal</span>
          <span>Control {fmtFecha(cur.fecha)}</span>
        </footer>
      </div>
    </div>
  )
}

function TablaIccPorDecada({ sexo, decadaIdx, nivelIdx }: { sexo: Sexo; decadaIdx: number; nivelIdx: number }) {
  // Mismos cortes que categoriaCinturaCadera (tabla-cintura-cadera.ts) — las etiquetas
  // de columna se derivan de esos mismos cortes, nunca copiados a mano.
  const filas = TABLA_CINTURA_CADERA[sexo]
  return (
    <table className="rt">
      <thead><tr><th>Edad</th>{RISK_LABEL.map((r) => <th key={r}>{r}</th>)}</tr></thead>
      <tbody>
        {filas.map((f, i) => {
          const celdas = [`<${fmt(f.bajoHasta, 2)}`, `${fmt(f.bajoHasta, 2)}–${fmt(f.moderadoHasta, 2)}`, `${fmt(f.moderadoHasta + 0.01, 2)}–${fmt(f.altoHasta, 2)}`, `>${fmt(f.altoHasta, 2)}`]
          return (
            <tr key={f.decadaDesde} className={i === decadaIdx ? 'on' : ''}>
              <th>{DEC_LABEL[i]}</th>
              {celdas.map((c, j) => <td key={j} className={i === decadaIdx && j === nivelIdx ? 'hit' : ''}>{c}</td>)}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
