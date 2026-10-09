'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ProfileData, SedePublica, TipoPropioPublico } from '@/app/p/[slug]/page'
import ProfileCard from './ProfileCard'
import SedeBreadcrumb from './SedeBreadcrumb'

export type SeleccionTipo = { tipo: 'sesion' | 'entrevista'; tipoTurnoId: string | null }

interface Props {
  profile: ProfileData
  sede: SedePublica | null
  multiSede: boolean
  tipo: 'sesion' | 'entrevista'
  tipoTurnoId: string | null
  tipoElegido: boolean
  swapNote: { sedeAnterior: string; tipoDescartado: string } | null
  modalidad: string
  onSeleccionar: (sel: SeleccionTipo, manual: boolean) => void
  onModalidad: (m: string) => void
  onNext: () => void
  onBack?: () => void
  onCambiarSede?: () => void
  descExpandidas: Set<string>
  onToggleDescExpandida: (id: string) => void
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Online',
  telefonica: 'Telefónica',
}

function formatPrice(price: number, moneda: string): string {
  const sym = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${sym}${price.toLocaleString('es-AR')}`
}

const ICON_CLK_SM = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  </svg>
)
const ICON_CAM_SM = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2.5" y="6.5" width="12" height="11" rx="2" /><path d="M14.5 11l7-3.5v9l-7-3.5z" />
  </svg>
)
const ICON_INFO = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted-2)', strokeWidth: 1.8, fill: 'none', flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
  </svg>
)
const ICON_SWAP = (
  <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: '#B45309', strokeWidth: 1.8, fill: 'none', flexShrink: 0, marginTop: 1 }}>
    <path d="M4 9h13l-3-3M20 15H7l3 3" />
  </svg>
)

type BaseOpt = { key: 'sesion' | 'entrevista'; label: string; desc: string; price: number | null; dur: number }
type Item = { kind: 'base'; opt: BaseOpt } | { kind: 'propio'; propio: TipoPropioPublico }

export default function StepTipoConsulta({
  profile,
  sede,
  multiSede,
  tipo,
  tipoTurnoId,
  tipoElegido,
  swapNote,
  modalidad,
  onSeleccionar,
  onModalidad,
  onNext,
  onBack,
  onCambiarSede,
  descExpandidas,
  onToggleDescExpandida,
}: Props) {
  // profile.tiposPropios ya viene filtrado server-side por plan + activo +
  // visible_en_booking (page.tsx) — length > 0 es exactamente "hay al menos un
  // tipo propio ofrecido en el link ahora mismo", incluido el caso de bajada
  // de plan a Esencial (ahí puedeUsarTiposTurno es false y queda en 0 sin
  // tocar las filas de tipos_turno en la base).
  const tieneTiposPropiosActivos = profile.tiposPropios.length > 0

  // Sin ningún tipo propio ofrecido, el flag de Sesión/Entrevista nunca puede
  // ser el único motivo de que el link quede sin nada para ofrecer — se
  // ignora (se lee como visible) sin modificar el dato guardado.
  const sesionVisible = profile.booking_sesion_visible || !tieneTiposPropiosActivos
  const entrevistaVisible = profile.booking_entrevista_visible || !tieneTiposPropiosActivos

  const hasSesion = profile.booking_precio_sesion !== null && profile.booking_precio_sesion !== undefined && sesionVisible
  const hasEntrevista = profile.booking_precio_entrevista !== null && profile.booking_precio_entrevista !== undefined && entrevistaVisible

  // showBoth es el fallback de "todavía no configuró nada": sin tipos propios
  // visibles, sin ningún precio base cargado, y los dos flags de visibilidad
  // en true. Si el profesional apagó algún flag a propósito, o ya tiene un
  // tipo propio visible cubriendo el link, nunca debe pisarlo mostrando ambos.
  const showBoth = !tieneTiposPropiosActivos
    && profile.booking_precio_sesion == null
    && profile.booking_precio_entrevista == null
    && profile.booking_sesion_visible
    && profile.booking_entrevista_visible

  const baseOptions: BaseOpt[] = []
  if (hasSesion || showBoth) {
    baseOptions.push({ key: 'sesion', label: 'Sesión', desc: 'Sesión individual', price: profile.booking_precio_sesion, dur: profile.booking_duracion_sesion })
  }
  if (hasEntrevista || showBoth) {
    baseOptions.push({ key: 'entrevista', label: 'Entrevista inicial', desc: 'Primera consulta de evaluación', price: profile.booking_precio_entrevista, dur: profile.booking_duracion_entrevista })
  }

  // Tipos base nunca se filtran por sede. Tipos propios: con 2+ sedes activas
  // (multiSede), solo los que tienen una fila en tipos_turno_sucursales para
  // la sede elegida — uno sin ninguna fila NO se ofrece. Con 0–1 sedes no se
  // filtra nada.
  const propios = multiSede
    ? (sede ? profile.tiposPropios.filter((t) => t.sucursalIds.includes(sede.id)) : [])
    : profile.tiposPropios

  // «Ver más» solo se muestra si el texto realmente se recorta a 2 líneas
  // (igual que fitVm() del diseño: compara scrollHeight contra clientHeight
  // del elemento clampeado). Solo se puede medir mientras está cerrado — una
  // vez medido queda cacheado en needsToggleRef, así que abrir la tarjeta no
  // vuelve a medir (ya no hay clamp activo para comparar).
  const descRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  const needsToggleRef = useRef<Record<string, boolean>>({})
  const [, bumpMedicion] = useState(0)
  const propiosDescKey = propios.map((p) => p.id).join(',')

  useLayoutEffect(() => {
    let cambio = false
    propios.forEach((p) => {
      if (!p.descripcion || descExpandidas.has(p.id)) return
      const el = descRefs.current[p.id]
      if (!el) return
      const desborda = el.scrollHeight > el.clientHeight + 1
      if (needsToggleRef.current[p.id] !== desborda) {
        needsToggleRef.current[p.id] = desborda
        cambio = true
      }
    })
    if (cambio) bumpMedicion((n) => n + 1)
  }, [propiosDescKey, descExpandidas])

  useEffect(() => {
    function medirEnResize() {
      let cambio = false
      propios.forEach((p) => {
        if (!p.descripcion || descExpandidas.has(p.id)) return
        const el = descRefs.current[p.id]
        if (!el) return
        const desborda = el.scrollHeight > el.clientHeight + 1
        if (needsToggleRef.current[p.id] !== desborda) {
          needsToggleRef.current[p.id] = desborda
          cambio = true
        }
      })
      if (cambio) bumpMedicion((n) => n + 1)
    }
    window.addEventListener('resize', medirEnResize)
    return () => window.removeEventListener('resize', medirEnResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiosDescKey, descExpandidas])

  const todos: Item[] = [
    ...baseOptions.map((opt): Item => ({ kind: 'base', opt })),
    ...propios.map((propio): Item => ({ kind: 'propio', propio })),
  ]

  const only = todos.length === 1
  const classic = propios.length === 0 && !only
  const onl = multiSede && !!sede?.es_online

  const todosKey = todos.map((it) => (it.kind === 'base' ? it.opt.key : it.propio.id)).join(',')

  // Sede con un solo tipo disponible: queda elegido solo (igual que el
  // diseño: tSel = all[0].id cuando only es true), sin pisar un swap-note ya
  // mostrado por el cambio de sede.
  useEffect(() => {
    if (!only) return
    const unico = todos[0]
    if (!unico) return
    if (unico.kind === 'base') {
      if (!(tipoElegido && tipoTurnoId === null && tipo === unico.opt.key)) {
        onSeleccionar({ tipo: unico.opt.key, tipoTurnoId: null }, false)
      }
    } else {
      if (!(tipoElegido && tipoTurnoId === unico.propio.id)) {
        onSeleccionar({ tipo: 'sesion', tipoTurnoId: unico.propio.id }, false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only, todosKey])

  const titulo = classic
    ? (onl ? '¿Qué tipo de videoconsulta necesitás?' : '¿Qué tipo de consulta necesitás?')
    : (onl ? 'Elegí el tipo de videoconsulta' : 'Elegí el tipo de consulta')

  const ocultarSubtitulo = !multiSede && classic
  const subtitulo = onl
    ? 'Todas son por videollamada. Te enviamos el link por email al confirmar.'
    : multiSede
    ? `Estas son las consultas que ${profile.nombre} ofrece en ${sede?.nombre ?? ''}.`
    : 'Cada tipo tiene su propia duración y precio.'

  return (
    <div>
      {multiSede ? (
        sede && onCambiarSede && <SedeBreadcrumb sede={sede} onCambiar={onCambiarSede} />
      ) : (
        <ProfileCard profile={profile} />
      )}

      {swapNote && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '12px 14px', borderRadius: 11,
          background: 'var(--amber-soft)', border: '1px solid #F6D58A',
          fontSize: 12.5, color: '#7A4B06', lineHeight: 1.55, marginBottom: 14,
        }}>
          {ICON_SWAP}
          <span>
            Cambiaste de <b style={{ color: '#5C3804', fontWeight: 650 }}>{swapNote.sedeAnterior}</b> a <b style={{ color: '#5C3804', fontWeight: 650 }}>{sede?.nombre}</b>. Descartamos <b style={{ color: '#5C3804', fontWeight: 650 }}>{swapNote.tipoDescartado}</b>: elegí de nuevo entre las consultas de esta sede.
          </span>
        </div>
      )}

      {/* Title */}
      <p style={{ margin: classic ? '0 0 12px' : '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        {titulo}
      </p>
      {!ocultarSubtitulo && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5B6472' }}>
          {subtitulo}
        </p>
      )}

      {/* Session type */}
      <div style={{ marginBottom: 18 }}>
        {classic ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: baseOptions.length === 1 ? '1fr' : '1fr 1fr',
            gap: 10,
          }}>
            {baseOptions.map((opt) => {
              const selected = tipoElegido && tipoTurnoId === null && tipo === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => onSeleccionar({ tipo: opt.key, tipoTurnoId: null }, true)}
                  style={{
                    background: selected ? '#F4F7FF' : '#F6F7F9',
                    border: selected ? '2px solid #002d72' : '2px solid transparent',
                    boxShadow: selected ? '0 0 0 3px rgba(0,45,114,0.12)' : 'none',
                    borderRadius: 14,
                    padding: '16px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: selected ? '#1e40af' : '#0B1220', marginBottom: 4 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#5B6472', marginBottom: 8 }}>
                    {opt.desc}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {opt.price !== null ? (
                      <span style={{ fontSize: 16, fontWeight: 700, color: selected ? '#1e40af' : '#0B1220' }}>
                        {formatPrice(opt.price, profile.booking_moneda)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, color: '#8A93A1' }}>A confirmar</span>
                    )}
                    <span style={{
                      fontSize: 11, color: '#8A93A1', background: '#fff',
                      borderRadius: 20, padding: '2px 8px', fontWeight: 500,
                    }}>
                      {opt.dur} min{onl ? ' · Videollamada' : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {baseOptions.map((opt) => {
              const selected = tipoElegido && tipoTurnoId === null && tipo === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => onSeleccionar({ tipo: opt.key, tipoTurnoId: null }, true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
                    background: selected ? 'var(--blue-soft-2)' : 'var(--surface)',
                    border: selected ? '1.5px solid var(--navy-2)' : '1px solid var(--border)',
                    borderRadius: 14, padding: '14px 16px',
                    boxShadow: selected ? '0 0 0 3px rgba(0,45,114,0.12)' : 'var(--shadow-sm)',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'border-color .14s ease, box-shadow .14s ease',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flex: 'none',
                    border: selected ? '1.5px solid var(--navy-2)' : '1.5px solid var(--border-strong)',
                    background: selected ? 'var(--navy-2)' : 'transparent',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                      {opt.label}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                      {ICON_CLK_SM}{opt.dur} min
                      {onl && (<><span style={{ color: 'var(--muted-3)' }}>·</span>{ICON_CAM_SM}Videollamada</>)}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontSize: 16, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                    {opt.price !== null ? (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginRight: 1 }}>
                          {profile.booking_moneda === 'USD' ? 'US$' : profile.booking_moneda === 'EUR' ? '€' : '$'}
                        </span>
                        {opt.price.toLocaleString('es-AR')}
                      </>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted-2)' }}>A confirmar</span>
                    )}
                  </span>
                </button>
              )
            })}

            {propios.map((propio) => {
              const selected = tipoElegido && tipoTurnoId === propio.id
              const sinCosto = propio.precio === null || propio.precio === 0
              const hasDs = !!propio.descripcion
              const open = descExpandidas.has(propio.id)
              const mostrarVm = open || !!needsToggleRef.current[propio.id]

              function handleVerMas(e: React.SyntheticEvent) {
                e.stopPropagation()
                e.preventDefault()
                onToggleDescExpandida(propio.id)
              }

              return (
                <button
                  key={propio.id}
                  onClick={() => onSeleccionar({ tipo: 'sesion', tipoTurnoId: propio.id }, true)}
                  style={{
                    display: 'flex', alignItems: hasDs ? 'flex-start' : 'center', gap: 13, width: '100%', textAlign: 'left',
                    background: selected ? 'var(--blue-soft-2)' : 'var(--surface)',
                    border: selected ? '1.5px solid var(--navy-2)' : '1px solid var(--border)',
                    borderRadius: 14, padding: '14px 16px',
                    boxShadow: selected ? '0 0 0 3px rgba(0,45,114,0.12)' : 'var(--shadow-sm)',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'border-color .14s ease, box-shadow .14s ease',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flex: 'none',
                    marginTop: hasDs ? 1 : 0,
                    border: selected ? '1.5px solid var(--navy-2)' : '1.5px solid var(--border-strong)',
                    background: selected ? 'var(--navy-2)' : 'transparent',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                      {propio.nombre}
                    </span>
                    {hasDs && (
                      <span style={{ display: 'block', marginTop: 3 }}>
                        <span
                          ref={(el) => { descRefs.current[propio.id] = el }}
                          style={{
                            fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)', fontWeight: 400,
                            display: open ? 'block' : '-webkit-box',
                            WebkitLineClamp: open ? 'unset' : 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: open ? 'visible' : 'hidden',
                          } as React.CSSProperties}
                        >
                          {propio.descripcion}
                        </span>
                        {mostrarVm && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={handleVerMas}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') handleVerMas(e)
                            }}
                            style={{
                              display: 'inline-block', marginTop: 2, fontSize: 12.5, fontWeight: 600,
                              color: 'var(--navy-2)', cursor: 'pointer', lineHeight: 1.45,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
                          >
                            {open ? 'Ver menos' : 'Ver más'}
                          </span>
                        )}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', marginTop: hasDs ? 6 : 3 }}>
                      {ICON_CLK_SM}{propio.duracion_min} min
                      {onl && (<><span style={{ color: 'var(--muted-3)' }}>·</span>{ICON_CAM_SM}Videollamada</>)}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontSize: 16, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                    {!sinCosto ? (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginRight: 1 }}>
                          {propio.moneda === 'USD' ? 'US$' : propio.moneda === 'EUR' ? '€' : '$'}
                        </span>
                        {(propio.precio as number).toLocaleString('es-AR')}
                      </>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted-2)' }}>Sin costo</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {only && sede && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '12px 14px', borderRadius: 11,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 18,
        }}>
          {ICON_INFO}
          <span>
            Es la única consulta que {profile.nombre} ofrece en <b>{sede.nombre}</b>, así que ya quedó elegida. Si buscás otra, cambiá de sede.
          </span>
        </div>
      )}

      {/* Modality — oculta con 2+ sedes, la fija la sede elegida */}
      {!multiSede && (
        <>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: '#8A93A1',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            margin: '0 0 12px',
          }}>
            Modalidad
          </h2>
          <div style={{
            display: 'flex', gap: 6,
            background: '#FFFFFF', border: '1px solid #E7E9EE',
            padding: 3, borderRadius: 10,
            marginBottom: 24,
          }}>
            {profile.booking_modalidades.map((m) => {
              const selected = modalidad === m
              return (
                <button
                  key={m}
                  onClick={() => onModalidad(m)}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 7, border: 'none',
                    background: selected ? '#0B1220' : 'transparent',
                    color: selected ? '#fff' : '#5B6472',
                    fontSize: 13, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all .12s ease',
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {m === 'presencial' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/>
                    </svg>
                  )}
                  {m === 'videollamada' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>
                    </svg>
                  )}
                  {m === 'telefonica' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  )}
                  {MODALIDAD_LABELS[m] ?? m}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* CTA row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {multiSede && onBack && (
          <button
            onClick={onBack}
            style={{
              flex: 'none', background: 'transparent', color: 'var(--muted)',
              border: 'none', borderRadius: 10, padding: '11px 12px',
              fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
            Atrás
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!tipoElegido}
          style={{
            flex: 1,
            background: tipoElegido ? 'linear-gradient(135deg, #001a48, #002d72)' : '#E7E9EE',
            color: tipoElegido ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 10,
            padding: '13px 18px',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: tipoElegido ? 'pointer' : 'not-allowed',
            letterSpacing: '-0.1px',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: tipoElegido ? '0 6px 18px rgba(0,45,114,0.25)' : 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Continuar
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  )
}
