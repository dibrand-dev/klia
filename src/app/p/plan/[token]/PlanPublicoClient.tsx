'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import './plan-publico.css'

const DIAS_VALUE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type ItemPublico = { tipo: string; nombre: string; cantidadGramos: number | null }
type ComidaPublica = { diaSemana: string; tipoComida: string; hora: string | null; nota: string | null; items: ItemPublico[] }

export interface PlanPublicoProps {
  profesionalNombreCorto: string
  especialidad: string
  matricula: string
  telefono: string | null
  email: string | null
  firmaSelloUrl: string | null
  avatarUrl: string | null
  pacientePrimerNombre: string
  pacienteNombreCompleto: string
  objetivoTitulo: string | null
  objetivoNota: string | null
  kcalObjetivo: number | null
  porcentajeCarbohidratos: number
  porcentajeProteinas: number
  porcentajeGrasas: number
  indicaciones: string[]
  fechaPreparacion: string
  fechaFin: string | null
  fechaActualizacion: string
  proximoTurno: { fechaHora: string; modalidad: string; direccionSede: string | null } | null
  comidas: ComidaPublica[]
  kcalPorDia: Record<string, number>
}

const ICON_MEAL: Record<string, JSX.Element> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  leaf: <path d="M12 20a7 7 0 0 0 7-7c0-4-3-6-3-9-2 1.5-3 3.5-3 5.5 0 1.5-1 2.5-2 2.5s-1.5-1-1.5-2C7 12 5 14 5 16.5A5.5 5.5 0 0 0 12 20z" />,
  fork: <path d="M5 3v7a2.5 2.5 0 0 0 5 0V3M7.5 12.5V21M19 3c-1.7 1.2-2.5 3-2.5 5.5S17.3 12 19 13v8" />,
  cup: <path d="M4 9h13a3 3 0 0 1 0 6H4zM4 9v6M17 12h3M6 19h11" />,
  moon: <path d="M18.5 12.5A6.5 6.5 0 1 1 11 5.05a5 5 0 0 0 7.5 7.45z" />,
}
function iconoPorComida(tipoComida: string): JSX.Element {
  const t = tipoComida.toLowerCase()
  if (t.includes('desayuno')) return ICON_MEAL.sun
  if (t.includes('colaci')) return ICON_MEAL.leaf
  if (t.includes('almuerzo')) return ICON_MEAL.fork
  if (t.includes('merienda')) return ICON_MEAL.cup
  if (t.includes('cena')) return ICON_MEAL.moon
  return ICON_MEAL.fork
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

function MACROS_LIST(pc: number, pp: number, pg: number, kcalObjetivo: number | null) {
  const gr = (pct: number, kpg: number) => kcalObjetivo != null ? Math.round((kcalObjetivo * pct / 100) / kpg) : null
  return [
    { key: 'cho', nombre: 'Carbohidratos', detalle: 'Cereales integrales, frutas, legumbres', color: '#3F519E', pct: pc, gramos: gr(pc, 4) },
    { key: 'prot', nombre: 'Proteínas', detalle: 'Carnes magras, huevo, lácteos', color: '#7D8AC4', pct: pp, gramos: gr(pp, 4) },
    { key: 'gra', nombre: 'Grasas', detalle: 'Palta, frutos secos, aceite de oliva', color: '#C6CCE5', pct: pg, gramos: gr(pg, 9) },
  ]
}

export default function PlanPublicoClient(props: PlanPublicoProps) {
  const {
    profesionalNombreCorto, especialidad, matricula, telefono, email, firmaSelloUrl, avatarUrl,
    pacientePrimerNombre, pacienteNombreCompleto, objetivoTitulo, objetivoNota, kcalObjetivo,
    porcentajeCarbohidratos, porcentajeProteinas, porcentajeGrasas, indicaciones,
    fechaPreparacion, fechaFin, fechaActualizacion, proximoTurno, comidas, kcalPorDia,
  } = props

  const dias = DIAS_VALUE
    .map((v, i) => ({ value: v, label: DIAS_LABEL[i], corto: DIAS_CORTO[i], comidas: comidas.filter((c) => c.diaSemana === v).sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '')) }))
    .filter((d) => d.comidas.length > 0)

  const chipsRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const [activo, setActivo] = useState(0)

  useEffect(() => {
    function onScroll() {
      const y = (chipsRef.current?.closest('.daynav')?.getBoundingClientRect().height ?? 50) + 24
      let a = 0
      sectionRefs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= y) a = i })
      setActivo(a)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function irADia(i: number) {
    const el = sectionRefs.current[i]
    const nav = chipsRef.current?.closest('.daynav') as HTMLElement | null
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (nav?.offsetHeight ?? 0) + 2, behavior: 'smooth' })
  }

  const macros = MACROS_LIST(porcentajeCarbohidratos, porcentajeProteinas, porcentajeGrasas, kcalObjetivo)
  const firmaTxt = profesionalNombreCorto.replace(/^Lic\.|^Dr\.|^Dra\.|^Mg\./i, '').trim()

  const vigenciaTxt = fechaFin
    ? `${format(parseISO(fechaPreparacion), 'd MMM', { locale: es })} — ${format(parseISO(`${fechaFin}T12:00:00`), 'd MMM yyyy', { locale: es })}`
    : `Desde el ${format(parseISO(fechaPreparacion), 'd MMM yyyy', { locale: es })}`

  const modalidadLabel: Record<string, string> = { presencial: 'Presencial', videollamada: 'Videollamada', telefonica: 'Telefónica' }
  const whatsappHref = telefono ? `https://wa.me/${telefono.replace(/\D/g, '')}` : null

  return (
    <div className="pp-root">
      <div id="plan">
        <div className="sheet">
          <header className="top pad">
            <div className="who">
              <span className="mark">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : (
                  <span className="fallback">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 12.6a4.05 4.05 0 1 0 0-8.1 4.05 4.05 0 0 0 0 8.1zM4.8 21c.6-3.7 3.6-5.9 7.2-5.9s6.6 2.2 7.2 5.9" />
                    </svg>
                  </span>
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{profesionalNombreCorto}</div>
                <div className="mn">{especialidad}{matricula ? ` · ${matricula}` : ''}</div>
              </div>
            </div>
            <button type="button" className="pdf-btn" title="Guardar como PDF" onClick={() => window.print()}>
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 15, height: 15 }}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" /></svg>
              <span>Guardar<span className="lg"> como PDF</span></span>
            </button>
          </header>

          <section className="cover pad">
            <p className="eyebrow">Plan alimentario personalizado</p>
            <h1 className="title">{pacientePrimerNombre},<br /><span className="ac">tu plan de la semana</span></h1>
            <p className="sub">Actualizado el {format(parseISO(fechaActualizacion), "d 'de' MMMM 'de' yyyy", { locale: es })}. Si tu profesional hace cambios, los vas a ver en este mismo link.</p>
            <div className="hero">
              <div className="goal">
                <p className="lbl">Objetivo del plan</p>
                <p className="val">{objetivoTitulo || 'Sin objetivo definido'}</p>
                {objetivoNota && <p className="note">{objetivoNota}</p>}
              </div>
              <div className="vct">
                <div>
                  <p className="lbl">Valor calórico diario</p>
                  <p className="big">{kcalObjetivo != null ? kcalObjetivo.toLocaleString('es-AR') : '—'}</p>
                  <p className="u">Kcal / día</p>
                </div>
                <p className="fine">Promedio de referencia. Puede variar ±100 kcal según el día.</p>
              </div>
            </div>
            <div className="macros">
              <div className="mbar" role="img" aria-label={`Distribución de macronutrientes: ${porcentajeCarbohidratos}% carbohidratos, ${porcentajeProteinas}% proteínas, ${porcentajeGrasas}% grasas`}>
                {macros.map((m) => <span key={m.key} className={m.key === 'gra' ? 'dk' : undefined} style={{ width: `${m.pct}%`, background: m.color }}>{m.pct} %</span>)}
              </div>
              <div className="mlist">
                {macros.map((m) => (
                  <div className="m" key={m.key}>
                    <span className="sw" style={{ background: m.color }} />
                    <div className="nm2">{m.nombre}<small>{m.detalle}</small></div>
                    <span className="pc">{m.pct} %</span>
                    <span className="gr">{m.gramos != null ? `${m.gramos} g` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
            {indicaciones.length > 0 && (
              <div className="panel">
                <h3>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" /></svg>
                  Indicaciones para arrancar
                </h3>
                <ul className="ind">
                  {indicaciones.map((t, i) => (
                    <li key={i}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="vig">
              <div className="it"><span className="lbl">Vigencia</span><b>{vigenciaTxt}</b></div>
              {proximoTurno && (
                <div className="it">
                  <span className="lbl">Próximo control</span>
                  <b>{cap(format(parseISO(proximoTurno.fechaHora), "EEE d MMM, HH:mm", { locale: es }))} h</b>
                </div>
              )}
              {proximoTurno && (
                <div className="it"><span className="lbl">Modalidad</span><b>{modalidadLabel[proximoTurno.modalidad] ?? proximoTurno.modalidad}</b></div>
              )}
              {proximoTurno?.direccionSede && (
                <div className="it w"><span className="lbl">Consultorio</span><b>{proximoTurno.direccionSede}</b></div>
              )}
            </div>
            {proximoTurno?.direccionSede && <p className="vig-note">La modalidad y la dirección corresponden a la sede de tu próximo turno.</p>}
          </section>

          {dias.length > 0 && (
            <nav className="daynav" aria-label="Días del plan">
              <div className="in pad" ref={chipsRef}>
                <span className="k">Ir a</span>
                {dias.map((d, i) => (
                  <button key={d.value} type="button" className={`chip${i === activo ? ' on' : ''}`} onClick={() => irADia(i)}>{d.corto}</button>
                ))}
              </div>
            </nav>
          )}

          <div className="pad">
            {dias.map((d, i) => {
              const kcal = kcalPorDia[d.value]
              return (
                <section key={d.value} className={`day t${(i % 3) + 1}`} ref={(el) => { sectionRefs.current[i] = el }}>
                  <div className="prh"><b>{profesionalNombreCorto}</b><span>{especialidad} · Plan alimentario</span></div>
                  <div className="day-hd">
                    <h2>{d.label}</h2>
                    <span className="kc">{kcal ? `≈ ${Math.round(kcal).toLocaleString('es-AR')} kcal · ` : ''}{d.comidas.length} {d.comidas.length === 1 ? 'comida' : 'comidas'}</span>
                  </div>
                  {d.comidas.map((c, ci) => (
                    <div className="meal" key={ci}>
                      <div className="side">
                        <div className="ttl">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{iconoPorComida(c.tipoComida)}</svg>
                          {c.tipoComida}
                        </div>
                        {c.hora && <div className="hr">{c.hora}</div>}
                      </div>
                      <div>
                        <ul className="items">
                          {c.items.map((it, ii) => (
                            <li key={ii}>{it.tipo === 'alimento' ? <><b>{it.nombre}</b>{it.cantidadGramos != null ? ` — ${it.cantidadGramos} g` : ''}</> : it.nombre}</li>
                          ))}
                        </ul>
                        {c.nota && (
                          <p className="tip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
                            <span>{c.nota}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              )
            })}
          </div>

          <section className="close pad">
            <p className="eyebrow">Cierre</p>
            <h2>Contacto</h2>
            <div className="contact">
              <dl>
                <div><dt>Profesional</dt><dd>{profesionalNombreCorto}</dd></div>
                <div><dt>Especialidad</dt><dd>{especialidad}</dd></div>
                <div><dt>Matrícula</dt><dd>{matricula || '—'}</dd></div>
              </dl>
              <dl>
                {telefono && <div><dt>Teléfono / WhatsApp</dt><dd><a href={whatsappHref ?? undefined}>{telefono}</a></dd></div>}
                {email && <div><dt>Email</dt><dd><a href={`mailto:${email}`}>{email}</a></dd></div>}
              </dl>
            </div>
            <div className="sign">
              <div>
                <div className="nmx">{profesionalNombreCorto}</div>
                <div className="mnx">{especialidad}{matricula ? ` · ${matricula}` : ''}</div>
              </div>
              <div className="fx">{firmaSelloUrl ? <img src={firmaSelloUrl} alt="Firma" /> : firmaTxt}</div>
            </div>
            <p className="conf">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
              <span><b>Confidencialidad.</b> Este plan es de uso personal de {pacienteNombreCompleto}. Contiene datos de salud protegidos por la Ley 25.326 de Protección de Datos Personales. No constituye una indicación válida para terceros.</span>
            </p>
          </section>
          <footer className="foot pad">
            <span>Plan alimentario · Documento de uso personal</span>
            <span>Actualizado {format(parseISO(fechaActualizacion), 'dd/MM/yyyy')}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
