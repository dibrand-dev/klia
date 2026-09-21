'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, isToday, isYesterday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatNombreCompleto } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/types/database'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useEffectiveTerapeutaId } from '@/lib/auth/useEffectiveTerapeutaId'
import { estadoAutorizacion } from '@/lib/pacientes/estadoAutorizacion'
import './directorio.css'

type PacienteListado = Paciente & { ultima_cita: string | null; proxima_sesion?: string | null }

const AVBG = ['#D6E0F5', '#FFD3CC', '#D5EFDF', '#FFF1D6', '#E8DAFF', '#DCEEF2']

const ESTADOS: [string, string][] = [
  ['', 'Estado: todos'],
  ['activo', 'En tratamiento'],
  ['inactivo', 'De alta'],
]

const SEG: [string, string][] = [
  ['', 'Última cita: todas'],
  ['7', 'En los últimos 7 días'],
  ['30', 'En los últimos 30 días'],
  ['60', 'Hace más de 60 días'],
  ['sin_consultas', 'Sin consultas registradas'],
]

function initials(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

function hashStr(s: string) {
  let h = 0
  for (const c of s) h += c.charCodeAt(0)
  return h
}

function formatFechaCorta(fecha: string): string {
  const d = parseISO(fecha)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

function formatProximaSesion(fecha: string): string {
  const d = parseISO(fecha)
  const diaLabel = isToday(d) ? 'Hoy' : isTomorrow(d) ? 'Mañana' : format(d, 'd MMM', { locale: es })
  return `${diaLabel} · ${format(d, 'HH:mm')}`
}

function diasDesde(fechaISO: string): number {
  return Math.floor((Date.now() - new Date(fechaISO).getTime()) / (24 * 60 * 60 * 1000))
}

function diasHasta(fechaISO: string): number {
  return Math.floor((new Date(fechaISO).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

// Misma regla de bucketing que page.tsx (server) — se repite acá para poder aplicar
// el filtro de "Última cita" también sobre los resultados de la búsqueda en vivo,
// que no pasan por esa query.
function matchesUltimaCita(ultimaCita: string | null, filtro: string): boolean {
  if (!filtro) return true
  if (filtro === 'sin_consultas') return ultimaCita === null
  if (ultimaCita === null) return false
  const dias = diasDesde(ultimaCita)
  if (filtro === '7') return dias <= 7
  if (filtro === '30') return dias <= 30
  if (filtro === '60') return dias > 60
  return true
}

export default function ListaPacientes({
  pacientes,
  totalCount = 0,
  totalGeneral = 0,
  enTratamientoGeneral = 0,
  currentPage = 1,
  pageSize = 12,
  estadoActual = '',
  ultimaCitaActual = '',
}: {
  pacientes: PacienteListado[]
  totalCount?: number
  totalGeneral?: number
  enTratamientoGeneral?: number
  currentPage?: number
  pageSize?: number
  estadoActual?: string
  ultimaCitaActual?: string
}) {
  const router = useRouter()
  const { terapeutaId } = useEffectiveTerapeutaId()
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<PacienteListado[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const texto = busqueda.trim()
    if (!texto) {
      setResultadosBusqueda(null)
      setBuscando(false)
      return
    }

    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      if (!terapeutaId) {
        console.error('[ListaPacientes] terapeutaId no resuelto todavía')
        setBuscando(false)
        return
      }
      if (cancelado) return
      const supabase = createClient()
      let query = supabase
        .from('pacientes')
        .select('*')
        .eq('terapeuta_id', terapeutaId)
        .or(`nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,dni.ilike.%${texto}%`)
        .order('apellido')
        .limit(50)
      if (estadoActual) query = query.eq('activo', estadoActual === 'activo')
      const { data } = await query
      if (cancelado) return
      const encontrados = data ?? []
      const ultimaCitaMap = new Map<string, string>()
      if (encontrados.length > 0) {
        const { data: turnos } = await supabase
          .from('turnos')
          .select('paciente_id, fecha_hora')
          .eq('terapeuta_id', terapeutaId)
          .eq('estado', 'realizado')
          .in('paciente_id', encontrados.map((p) => p.id))
          .order('fecha_hora', { ascending: false })
        for (const t of turnos ?? []) {
          if (!ultimaCitaMap.has(t.paciente_id)) ultimaCitaMap.set(t.paciente_id, t.fecha_hora)
        }
      }
      if (cancelado) return
      const conActividad = encontrados.map((p) => ({ ...p, ultima_cita: ultimaCitaMap.get(p.id) ?? null })) as PacienteListado[]
      const conUltimaCita = ultimaCitaActual
        ? conActividad.filter((p) => matchesUltimaCita(p.ultima_cita, ultimaCitaActual))
        : conActividad
      setResultadosBusqueda(conUltimaCita)
      setBuscando(false)
    }, 300)

    return () => { cancelado = true; clearTimeout(timer) }
  }, [busqueda, terapeutaId, estadoActual, ultimaCitaActual])

  // Estado y última cita ya se aplican server-side (page.tsx, vía ?estado= y
  // ?ultima_cita=) antes de paginar — acá no hay que volver a filtrar por eso,
  // salvo cuando hay búsqueda de texto activa (esa sí es un query aparte).
  const filtrados = resultadosBusqueda ?? pacientes
  const hasTexto = !!busqueda.trim()
  const hasFiltros = !!estadoActual || !!ultimaCitaActual
  const resCount = hasTexto ? filtrados.length : totalCount

  function pushParams(estado: string, ultimaCita: string) {
    const params = new URLSearchParams()
    if (estado) params.set('estado', estado)
    if (ultimaCita) params.set('ultima_cita', ultimaCita)
    router.push(`/pacientes${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  function limpiarTodo() {
    setBusqueda('')
    router.push('/pacientes', { scroll: false })
  }

  return (
    <div className="dir-wrap">
      <div className="dir-pg-hd">
        <div className="tx">
          <h1>Pacientes</h1>
          <p>
            {totalGeneral === 0 ? (
              'Todavía no cargaste ningún paciente.'
            ) : (
              <>
                <b>{totalGeneral}</b> pacientes en tu consultorio · <b>{enTratamientoGeneral}</b> en tratamiento activo
              </>
            )}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 5v14M5 12h14" /></svg>
          Nuevo paciente
        </Link>
      </div>

      {totalGeneral > 0 && (
        <>
          <div className="dir-tools">
            <div className={`dir-srch${hasTexto ? ' has' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                type="search"
                placeholder="Buscar por nombre, apellido o DNI"
                autoComplete="off"
                aria-label="Buscar pacientes"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {buscando ? (
                <span className="dir-spin" aria-hidden="true" />
              ) : hasTexto ? (
                <button className="dir-clr" aria-label="Limpiar búsqueda" onClick={() => setBusqueda('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              ) : null}
            </div>
            <div className="dir-sel">
              <select
                aria-label="Estado"
                className={estadoActual ? 'on' : ''}
                value={estadoActual}
                onChange={(e) => pushParams(e.target.value, ultimaCitaActual)}
              >
                {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="dir-sel">
              <select
                aria-label="Última cita"
                className={ultimaCitaActual ? 'on' : ''}
                value={ultimaCitaActual}
                onChange={(e) => pushParams(estadoActual, e.target.value)}
              >
                {SEG.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="dir-resbar">
            <span className="cnt"><b>{resCount}</b> {resCount === 1 ? 'paciente' : 'pacientes'}</span>
            {hasTexto || hasFiltros ? (
              <>
                <span className="and">que cumplen</span>
                {hasTexto && (
                  <span className="dir-chip q">
                    <i>Texto:</i><span>{busqueda.trim()}</span>
                    <button aria-label="Quitar búsqueda" onClick={() => setBusqueda('')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </span>
                )}
                {estadoActual && (
                  <span className="dir-chip">
                    <span>{ESTADOS.find(([v]) => v === estadoActual)?.[1]}</span>
                    <button aria-label="Quitar filtro de estado" onClick={() => pushParams('', ultimaCitaActual)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </span>
                )}
                {ultimaCitaActual && (
                  <span className="dir-chip">
                    <span>{SEG.find(([v]) => v === ultimaCitaActual)?.[1]}</span>
                    <button aria-label="Quitar filtro de última cita" onClick={() => pushParams(estadoActual, '')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </span>
                )}
                <button className="dir-lnk" onClick={limpiarTodo}>Limpiar todo</button>
              </>
            ) : (
              <span>· sin filtros aplicados</span>
            )}
          </div>
        </>
      )}

      {totalGeneral === 0 ? (
        <div className="dir-blank">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
          </div>
          <h3>Tu directorio todavía está vacío</h3>
          <p>Acá vas a ver a todos tus pacientes, con su última consulta y su próxima sesión. Cargá el primero y aparece en la agenda, en cobros y en los informes automáticamente.</p>
          <div className="acts">
            <Link href="/pacientes/nuevo" className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 5v14M5 12h14" /></svg>
              Cargar primer paciente
            </Link>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="dir-blank neutral">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </div>
          <h3>Ningún paciente cumple con todo lo que pediste</h3>
          <p>
            La búsqueda se aplica <em>dentro</em> de los filtros activos.{' '}
            {hasTexto
              ? <>No hay coincidencias de <em>&ldquo;{busqueda.trim()}&rdquo;</em> entre los pacientes filtrados.</>
              : 'Probá aflojar alguno de los filtros.'}
          </p>
          <div className="acts">
            {hasTexto && hasFiltros && (
              <button className="btn primary" onClick={() => pushParams('', '')}>
                Buscar &ldquo;{busqueda.trim()}&rdquo; en todos los pacientes
              </button>
            )}
            <button className="btn" onClick={limpiarTodo}>Limpiar filtros</button>
            <Link href="/pacientes/nuevo" className="btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 5v14M5 12h14" /></svg>
              Crear paciente nuevo
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="dir-grid">
            {filtrados.map((paciente) => (
              <PacienteCard key={paciente.id} paciente={paciente} />
            ))}
          </div>

          {!resultadosBusqueda && totalCount > pageSize && (
            <Paginador
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / pageSize)}
              estadoActual={estadoActual}
              ultimaCitaActual={ultimaCitaActual}
            />
          )}
        </>
      )}
    </div>
  )
}

function Paginador({
  currentPage,
  totalPages,
  estadoActual,
  ultimaCitaActual,
}: {
  currentPage: number
  totalPages: number
  estadoActual: string
  ultimaCitaActual: string
}) {
  const router = useRouter()

  function goTo(page: number) {
    const params = new URLSearchParams()
    if (estadoActual) params.set('estado', estadoActual)
    if (ultimaCitaActual) params.set('ultima_cita', ultimaCitaActual)
    params.set('page', String(page))
    router.push(`/pacientes?${params.toString()}`)
  }

  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (currentPage > 3) pages.push('…')
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
      pages.push(p)
    }
    if (currentPage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="dir-pager">
      <button className="pg" disabled={currentPage <= 1} onClick={() => goTo(currentPage - 1)} aria-label="Página anterior">‹</button>
      {pageNumbers().map((p, i) =>
        p === '…' ? (
          <span key={`ell-${i}`} className="gap">…</span>
        ) : (
          <button key={p} className={`pg${p === currentPage ? ' on' : ''}`} onClick={() => p !== currentPage && goTo(p as number)}>{p}</button>
        )
      )}
      <button className="pg" disabled={currentPage >= totalPages} onClick={() => goTo(currentPage + 1)} aria-label="Página siguiente">›</button>
    </div>
  )
}

function PacienteCard({ paciente }: { paciente: PacienteListado }) {
  const router = useRouter()
  const { esColaborador } = useEffectiveTerapeutaId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const nombre = formatNombreCompleto(paciente.nombre, paciente.apellido)
  const motivo = paciente.motivo_consulta?.trim() || paciente.notas?.split('\n')[0]?.trim() || null
  const autorizacion = estadoAutorizacion(paciente.autorizacion_vigencia_hasta)
  const proximaEnPocosDias = paciente.proxima_sesion ? diasHasta(paciente.proxima_sesion) <= 7 : false

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function doEliminar() {
    const supabase = createClient()
    const { error, data } = await supabase.from('pacientes').delete().eq('id', paciente.id).select('id')
    if (error) { alert('Error al eliminar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se pudo eliminar el paciente. Puede que no tengas permiso para esta acción.'); return }
    router.refresh()
  }

  return (
    <>
    <div
      className="dir-pcard"
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/pacientes/${paciente.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/pacientes/${paciente.id}`)
        }
      }}
    >
      <div className="dir-pc-top">
        <div className="dir-av" style={{ background: AVBG[hashStr(nombre) % AVBG.length] }}>{initials(paciente.nombre, paciente.apellido)}</div>
        <div className="dir-pc-id">
          <h3>{nombre}</h3>
          <span className="code">PAC-{paciente.id.slice(0, 8).toUpperCase()}</span>
        </div>

        <div ref={menuRef} className="dir-menu-wrap">
          <button
            className={`dir-menu-btn${menuOpen ? ' open' : ''}`}
            aria-label={`Más acciones para ${nombre}`}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /></svg>
          </button>
          {menuOpen && (
            <div className="dir-menu">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); router.push(`/pacientes/${paciente.id}?edit=1`) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                Editar
              </button>
              {!esColaborador && (
                <button className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmOpen(true) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dir-pc-badges">
        {paciente.activo ? <span className="dir-bdg trat">En tratamiento</span> : <span className="dir-bdg alta">De alta</span>}
        {autorizacion && (
          <span className={`dir-bdg ${autorizacion.tono === 'vencida' ? 'alert' : 'porvencer'}`}>{autorizacion.label}</span>
        )}
      </div>

      <div className="dir-pc-facts">
        {paciente.ultima_cita ? (
          <div className="dir-fact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></svg>
            <span>Última consulta</span><b>{formatFechaCorta(paciente.ultima_cita)}</b>
          </div>
        ) : (
          <div className="dir-fact none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></svg>
            <span>Aún sin consultas registradas</span>
          </div>
        )}
        {paciente.proxima_sesion ? (
          <div className={`dir-fact${proximaEnPocosDias ? ' soon' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
            <span>Próxima</span><b>{formatProximaSesion(paciente.proxima_sesion)}</b>
          </div>
        ) : (
          <div className="dir-fact none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
            <span>Sin próxima sesión agendada</span>
          </div>
        )}
      </div>

      {motivo ? (
        <p className="dir-pc-note">{motivo}</p>
      ) : (
        <p className="dir-pc-note none">Sin motivo de consulta cargado todavía.</p>
      )}

      <div className="dir-pc-foot">
        <span className="go">
          Ver perfil
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </div>
    </div>

    <ConfirmDialog
      open={confirmOpen}
      title={`Eliminar a ${nombre}`}
      message="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      variant="danger"
      onConfirm={() => { setConfirmOpen(false); doEliminar() }}
      onCancel={() => setConfirmOpen(false)}
    />
  </>
  )
}
