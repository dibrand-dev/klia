'use client'

import './paciente-header.css'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseISO, differenceInYears, format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { formatNombreCompleto } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Paciente, Turno } from '@/types/database'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useEffectiveTerapeutaId } from '@/lib/auth/useEffectiveTerapeutaId'

export interface SummaryData {
  sesionesRealizadas: number
  proximaSesion: Turno | null
  tratamientoDesde: string | null
  impagos: number
  montoImpago: number
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Videollamada',
  telefonica: 'Telefónica',
}

export default function PacienteHeader({
  paciente,
  summary,
  turnoRecurrente = null,
}: {
  paciente: Paciente
  summary: SummaryData
  turnoRecurrente?: { dia_semana: number; hora: string } | null
}) {
  const router = useRouter()
  const { esColaborador } = useEffectiveTerapeutaId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase()
  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  async function handleEliminar() {
    const supabase = createClient()
    const { error, data } = await supabase.from('pacientes').delete().eq('id', paciente.id).select('id')
    if (error) { alert('Error al eliminar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se pudo eliminar el paciente. Puede que no tengas permiso para esta acción.'); return }
    router.push('/pacientes')
  }

  const proximaSesionLabel = (() => {
    if (!summary.proximaSesion) return null
    const d = parseISO(summary.proximaSesion.fecha_hora)
    return format(d, "EEEE d MMM '·' HH:mm", { locale: es })
  })()

  const cuentaLabel = (() => {
    if (summary.impagos === 0) return '$ 0 · al día'
    const monto = summary.montoImpago
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(summary.montoImpago)
      : '—'
    return `${monto} · pendiente`
  })()

  const tratamientoDesdeLabel = summary.tratamientoDesde
    ? format(parseISO(summary.tratamientoDesde), 'MMMM yyyy', { locale: es })
    : null

  const frecuenciaLabel = turnoRecurrente
    ? `${DIAS_SEMANA[turnoRecurrente.dia_semana]} ${turnoRecurrente.hora.slice(0, 5)}`
    : paciente.frecuencia_sesiones

  return (
    <>
      {/* Breadcrumb — no forma parte del diseño de patient-hdr (eso pertenece al topbar global,
          fuera de scope de esta fase), se mantiene la navegación existente */}
      <nav className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">
        <Link href="/pacientes" className="hover:text-primary transition-colors">
          Pacientes
        </Link>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-primary/60 capitalize">
          {formatNombreCompleto(paciente.nombre, paciente.apellido)}
        </span>
      </nav>

      <header className="patient-hdr">
        <div className="patient-top">
          <div className="avatar">{iniciales}</div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="patient-id-row">
              <span className="mono">PAC-{paciente.id.slice(0, 8).toUpperCase()}</span>
              <span className={`pill-status ${paciente.activo ? '' : 'inactivo'}`}>
                <span className="dot" />
                {paciente.activo ? 'En tratamiento' : 'Inactivo'}
              </span>
            </div>

            <h1 className="patient-name">{formatNombreCompleto(paciente.nombre, paciente.apellido)}</h1>

            <div className="patient-meta">
              {(edad !== null || paciente.genero) && (
                <span>
                  <svg className="icn" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                  {edad !== null ? `${edad} años` : ''}{edad !== null && paciente.genero ? ' · ' : ''}{paciente.genero ?? ''}
                </span>
              )}
              {/* Ubicación omitida en esta fase: `domicilio` es dirección libre completa
                  (ej. "Av. Corrientes 1234, piso 8º, CABA"), no una ciudad corta como pide
                  el chip del diseño — mostrarla acá desbordaría o se vería roto. El dato
                  completo ya está disponible en la tab "Datos personales". */}
              {paciente.obra_social && (
                <span>
                  <svg className="icn" viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 9h16" /></svg>
                  {paciente.obra_social}{paciente.plan_obra_social ? ` — ${paciente.plan_obra_social}` : ''}
                </span>
              )}
              {frecuenciaLabel && (
                <span>
                  <svg className="icn" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  {frecuenciaLabel}
                </span>
              )}
            </div>
          </div>

          <div className="patient-actions">
            <div className="more-wrap" ref={menuRef}>
              <button
                className="ph-btn ghost"
                title="Más acciones"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
              </button>
              <div className={`ph-menu ${menuOpen ? 'open' : ''}`} role="menu">
                <button
                  className="ph-menu-item"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); router.push(`/pacientes/${paciente.id}?edit=1`) }}
                >
                  <svg viewBox="0 0 24 24"><path d="M12 20h9M16 3l5 5-11 11H5v-5z" /></svg>
                  <span>Editar paciente</span>
                </button>
                {!esColaborador && (
                  <>
                    <div className="ph-menu-sep" />
                    <button
                      className="ph-menu-item danger"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setConfirmOpen(true) }}
                    >
                      <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" /></svg>
                      <span>Eliminar paciente</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              className="ph-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('openNuevoTurno', { detail: { pacienteId: paciente.id } }))}
            >
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              Nueva sesión
            </button>
            <button
              className="ph-btn primary"
              onClick={() => window.dispatchEvent(new CustomEvent('openNuevaNotaClinica', { detail: { pacienteId: paciente.id, modo: 'texto' } }))}
            >
              <svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z" /><path d="M8 4v6h8" /><path d="M8 15h8M8 18h5" /></svg>
              Nota clínica
            </button>
          </div>
        </div>

        <div className="summary-strip">
          <div className="sum-cell">
            <div className="sum-k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4z" /><path d="M4 9h16M8 5v14" /></svg>
              Motivo de consulta
            </div>
            <div className="sum-v">{paciente.motivo_consulta || '—'}</div>
            {/* TODO: no existe un campo de "derivado por" en el modelo de paciente actual */}
          </div>

          <div className="sum-cell">
            <div className="sum-k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              En tratamiento desde
            </div>
            <div className="sum-v">
              {tratamientoDesdeLabel ? <span className="capitalize">{tratamientoDesdeLabel}</span> : '—'}
            </div>
            {summary.sesionesRealizadas > 0 && (
              <div className="sum-sub">{summary.sesionesRealizadas} sesiones realizadas</div>
            )}
          </div>

          <div className="sum-cell">
            <div className="sum-k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></svg>
              Próxima sesión
            </div>
            <div className="sum-v capitalize">{proximaSesionLabel || 'Sin turno próximo'}</div>
            {summary.proximaSesion && (
              <div className="sum-sub">{MODALIDAD_LABEL[summary.proximaSesion.modalidad] ?? summary.proximaSesion.modalidad}</div>
            )}
          </div>

          <div className="sum-cell">
            <div className="sum-k">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 6h14l1 14H4L5 6z" /></svg>
              Estado de cuenta
            </div>
            <div className="sum-v">{cuentaLabel}</div>
            {/* TODO: no hay un dato de "último pago" fácilmente disponible acá — requeriría una query extra a `cobros` */}
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar paciente"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); handleEliminar() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
