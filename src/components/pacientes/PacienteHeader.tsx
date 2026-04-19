'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, differenceInYears, differenceInMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { formatNombreCompleto } from '@/lib/utils'
import type { Paciente, Turno } from '@/types/database'

export interface SummaryData {
  sesionesRealizadas: number
  proximaSesion: Turno | null
  tratamientoDesde: string | null
  impagos: number
  montoImpago: number
}

export default function PacienteHeader({
  paciente,
  summary,
}: {
  paciente: Paciente
  summary: SummaryData
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase()
  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  const metaItems: { icon: string; text: string }[] = []
  if (edad !== null) {
    metaItems.push({
      icon: 'user',
      text: `${edad} años`,
    })
  }
  if (paciente.obra_social) {
    const afiliado = paciente.numero_afiliado ? ` · ${paciente.numero_afiliado}` : ''
    metaItems.push({ icon: 'card', text: `${paciente.obra_social}${afiliado}` })
  }
  if (paciente.telefono) {
    metaItems.push({ icon: 'phone', text: paciente.telefono })
  }
  if (paciente.email) {
    metaItems.push({ icon: 'mail', text: paciente.email })
  }

  // Summary strip data
  const motivo = paciente.notas?.split('\n')[0]?.trim() || null

  const tratamientoDesdeLabel = (() => {
    if (!summary.tratamientoDesde) return '—'
    const d = parseISO(summary.tratamientoDesde)
    const meses = differenceInMonths(new Date(), d)
    const mesTxt = format(d, 'MMMM yyyy', { locale: es })
    const mesesTxt = meses < 1 ? 'menos de un mes' : meses === 1 ? '1 mes' : `${meses} meses`
    return { label: mesTxt, sub: mesesTxt }
  })()

  const proximaSesionLabel = (() => {
    if (!summary.proximaSesion) return null
    const d = parseISO(summary.proximaSesion.fecha_hora)
    const dia = format(d, "EEE d 'de' MMM", { locale: es })
    const hora = format(d, 'HH:mm')
    const modalidad = summary.proximaSesion.modalidad
    const modalidadLabel = modalidad === 'presencial' ? 'Presencial' : modalidad === 'videollamada' ? 'Videollamada' : 'Telefónica'
    return { label: `${dia} · ${hora}`, sub: modalidadLabel }
  })()

  const cuentaLabel = (() => {
    if (summary.impagos === 0) return { label: '$ 0', light: 'al día', sub: 'Sin pagos pendientes' }
    const monto = summary.montoImpago
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(summary.montoImpago)
      : '—'
    return {
      label: monto,
      light: `${summary.impagos} ${summary.impagos === 1 ? 'pendiente' : 'pendientes'}`,
      sub: 'Sesiones sin cobrar',
    }
  })()

  async function handleEliminar() {
    setMenuOpen(false)
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error } = await supabase.from('pacientes').delete().eq('id', paciente.id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    router.push('/pacientes')
  }

  async function handleInactivar() {
    setMenuOpen(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('pacientes')
      .update({ activo: !paciente.activo })
      .eq('id', paciente.id)
    if (error) {
      alert('Error al actualizar: ' + error.message)
      return
    }
    router.refresh()
  }

  return (
    <header className="pt-6 pb-5">
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-[13px] text-muted mb-5">
        <Link href="/pacientes" className="hover:text-ink transition-colors">
          Pacientes
        </Link>
        <span className="text-muted-3">/</span>
        <span className="text-ink font-medium truncate">
          {formatNombreCompleto(paciente.nombre, paciente.apellido)}
        </span>
      </div>

      {/* Patient top */}
      <div className="flex flex-wrap items-start gap-4 sm:gap-[18px]">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-[14px] flex items-center justify-center flex-shrink-0 select-none"
          style={{
            background: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)',
            color: '#16389F',
            boxShadow: 'inset 0 0 0 1px rgba(31,79,217,0.10)',
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: '-0.02em',
          }}
        >
          {iniciales}
        </div>

        <div className="min-w-0 flex-1">
          {/* ID row */}
          <div className="flex items-center gap-2 text-[12px] text-muted-2 mb-0.5">
            <span className="font-mono text-[11.5px] text-muted" style={{ letterSpacing: '0.02em' }}>
              PAC-{paciente.id.slice(0, 8).toUpperCase()}
            </span>
            {paciente.activo ? (
              <span className="inline-flex items-center gap-1 px-[7px] py-0.5 rounded-full bg-ok-soft text-ok text-[10.5px] font-semibold uppercase" style={{ letterSpacing: '0.02em' }}>
                <span className="w-[5px] h-[5px] rounded-full bg-ok" />
                En tratamiento
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-[7px] py-0.5 rounded-full bg-surface-3 text-muted text-[10.5px] font-semibold uppercase" style={{ letterSpacing: '0.02em' }}>
                <span className="w-[5px] h-[5px] rounded-full bg-muted-3" />
                Inactivo
              </span>
            )}
          </div>

          {/* Name */}
          <h1
            className="text-[24px] sm:text-[28px] text-ink font-semibold leading-[1.15] m-0 mb-1.5"
            style={{ letterSpacing: '-0.02em' }}
          >
            {formatNombreCompleto(paciente.nombre, paciente.apellido)}
          </h1>

          {/* Meta row */}
          {metaItems.length > 0 && (
            <div className="flex flex-wrap items-center text-[13px] text-muted gap-y-1">
              {metaItems.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-[5px]">
                  {i > 0 && (
                    <span
                      className="inline-block w-[3px] h-[3px] rounded-full bg-muted-3 mx-[10px]"
                      aria-hidden
                    />
                  )}
                  <MetaIcon name={item.icon} />
                  <span>{item.text}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              className="klin-btn-ghost !px-2"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Más acciones"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="19" cy="12" r="1.4" />
              </svg>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute top-[calc(100%+6px)] right-0 min-w-[220px] bg-white border border-line rounded-[10px] shadow-klin-md p-1.5 z-30"
              >
                <Link
                  href={`/pacientes/${paciente.id}?edit=1`}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13.5px] text-ink-2 hover:bg-surface-2 transition-colors"
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M12 20h9M16 3l5 5-11 11H5v-5z" />
                  </svg>
                  <span>Editar paciente</span>
                </Link>
                <button
                  type="button"
                  onClick={handleInactivar}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13.5px] text-ink-2 hover:bg-surface-2 transition-colors text-left"
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <rect x="3" y="4" width="18" height="5" />
                    <path d="M5 9v11h14V9M10 13h4" />
                  </svg>
                  <span>{paciente.activo ? 'Marcar como inactivo' : 'Reactivar paciente'}</span>
                </button>
                <div className="h-px bg-line my-1 mx-0.5" />
                <button
                  type="button"
                  onClick={handleEliminar}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13.5px] text-danger hover:bg-danger-soft transition-colors text-left"
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
                  </svg>
                  <span>Eliminar paciente</span>
                </button>
              </div>
            )}
          </div>
          <Link href="/turnos/nuevo" className="klin-btn">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva sesión
          </Link>
          <Link href={`/pacientes/${paciente.id}/historial/nueva`} className="klin-btn-primary">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 4h12l4 4v12H4z" />
              <path d="M8 4v6h8" />
              <path d="M8 15h8M8 18h5" />
            </svg>
            Nota clínica
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-line rounded-klin-lg overflow-hidden">
        <SumCell
          icon={
            <>
              <path d="M4 5h16v14H4z" />
              <path d="M4 9h16M8 5v14" />
            </>
          }
          k="Motivo de consulta"
          v={motivo || '—'}
          sub={motivo ? undefined : 'Agregalo en los datos del paciente'}
          borderR
          borderBSm
        />
        <SumCell
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>
          }
          k="En tratamiento desde"
          v={
            typeof tratamientoDesdeLabel === 'object' ? (
              <>
                <span className="capitalize">{tratamientoDesdeLabel.label}</span>{' '}
                <span className="text-muted font-normal">· {tratamientoDesdeLabel.sub}</span>
              </>
            ) : (
              tratamientoDesdeLabel
            )
          }
          sub={summary.sesionesRealizadas > 0 ? `${summary.sesionesRealizadas} ${summary.sesionesRealizadas === 1 ? 'sesión realizada' : 'sesiones realizadas'}` : 'Sin sesiones realizadas'}
          borderBSm
          borderRLg
        />
        <SumCell
          icon={
            <>
              <path d="M8 2v4M16 2v4M3 10h18" />
              <rect x="3" y="4" width="18" height="18" rx="2" />
            </>
          }
          k="Próxima sesión"
          v={proximaSesionLabel ? <span className="capitalize">{proximaSesionLabel.label}</span> : '—'}
          sub={proximaSesionLabel ? proximaSesionLabel.sub : 'Sin turnos próximos'}
          borderR
        />
        <SumCell
          icon={
            <>
              <path d="M3 10h18M5 6h14l1 14H4L5 6z" />
            </>
          }
          k="Estado de cuenta"
          v={
            <>
              {cuentaLabel.label} <span className="text-muted font-normal">· {cuentaLabel.light}</span>
            </>
          }
          sub={cuentaLabel.sub}
        />
      </div>
    </header>
  )
}

function SumCell({
  icon,
  k,
  v,
  sub,
  borderR,
  borderRLg,
  borderBSm,
}: {
  icon: React.ReactNode
  k: string
  v: React.ReactNode
  sub?: React.ReactNode
  borderR?: boolean
  borderRLg?: boolean
  borderBSm?: boolean
}) {
  return (
    <div
      className={[
        'px-4 py-3.5',
        borderR ? 'sm:border-r border-line' : '',
        borderRLg ? 'lg:border-r border-line' : '',
        borderBSm ? 'border-b sm:border-b-0 border-line' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-2 uppercase mb-1" style={{ letterSpacing: '0.05em' }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          {icon}
        </svg>
        {k}
      </div>
      <div className="text-[15px] font-medium text-ink leading-tight" style={{ letterSpacing: '-0.01em' }}>
        {v}
      </div>
      {sub && <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function MetaIcon({ name }: { name: string }) {
  const common = 'inline-block stroke-muted-2'
  if (name === 'user') {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} className={common}>
        <circle cx="12" cy="8" r="4" stroke="currentColor" />
        <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" />
      </svg>
    )
  }
  if (name === 'card') {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} className={common}>
        <path d="M4 6h16v12H4z" stroke="currentColor" />
        <path d="M4 9h16" stroke="currentColor" />
      </svg>
    )
  }
  if (name === 'phone') {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} className={common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.8.63 2.65a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.43-1.2a2 2 0 0 1 2.11-.45c.85.3 1.74.51 2.65.63A2 2 0 0 1 22 16.92z" stroke="currentColor" />
      </svg>
    )
  }
  if (name === 'mail') {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} className={common}>
        <path d="M4 4h16v16H4z" stroke="currentColor" />
        <path d="M4 4l8 8 8-8" stroke="currentColor" />
      </svg>
    )
  }
  return null
}
