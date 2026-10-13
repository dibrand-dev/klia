'use client'

import { useState } from 'react'

type Estado = 'pendiente' | 'confirmado' | 'cancelado' | 'realizado' | 'no_asistio'

interface Props {
  token: string
  estadoInicial: Estado
  accionInicial: 'confirmar' | 'cancelar' | null
  profesionalNombre: string
  profesionalEspecialidad: string | null
  fecha: string
  hora: string
  duracionMin: number
  modalidad: string
  pagado: boolean
}

function modalidadLabel(m: string): string {
  if (m === 'presencial') return 'Presencial'
  if (m === 'videollamada') return 'Videollamada'
  if (m === 'telefonica') return 'Telefónica'
  return m
}

type ApiResponse = { ok?: boolean; error?: string; estado?: Estado; pagado?: boolean; tardia?: boolean }

export default function TurnoAccionClient({
  token,
  estadoInicial,
  accionInicial,
  profesionalNombre,
  profesionalEspecialidad,
  fecha,
  hora,
  duracionMin,
  modalidad,
  pagado: pagadoInicial,
}: Props) {
  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [pagado, setPagado] = useState(pagadoInicial)
  const [pasoCancelar, setPasoCancelar] = useState(accionInicial === 'cancelar')
  const destacarConfirmar = accionInicial === 'confirmar'
  const [loading, setLoading] = useState<'confirmar' | 'cancelar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function llamarApi(accion: 'confirmar' | 'cancelar') {
    setLoading(accion)
    setError(null)
    try {
      const res = await fetch('/api/turnos/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion }),
      })
      const data = await res.json() as ApiResponse

      if (data.estado) setEstado(data.estado)
      if (data.pagado !== undefined) setPagado(data.pagado)

      if (!res.ok && !data.estado) {
        // 409/500 sin estado para refrescar — error genérico, se puede reintentar.
        setError('No pudimos procesar la acción. Probá de nuevo en un momento.')
      } else {
        setPasoCancelar(false)
      }
    } catch {
      setError('No pudimos procesar la acción. Probá de nuevo en un momento.')
    } finally {
      setLoading(null)
    }
  }

  const detalleCard = (
    <div className="w-full card p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        Detalle del turno
      </p>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Profesional</span>
          <span className="text-sm font-medium text-right" style={{ color: 'var(--ink-2)' }}>
            {profesionalNombre}
            {profesionalEspecialidad && <><br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{profesionalEspecialidad}</span></>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Fecha</span>
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{fecha}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Horario</span>
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{hora} · {duracionMin} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Modalidad</span>
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{modalidadLabel(modalidad)}</span>
        </div>
      </div>
    </div>
  )

  function renderContenido() {
    if (estado === 'realizado' || estado === 'no_asistio') {
      return (
        <div className="w-full card p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>Este turno ya pasó. No hay ninguna acción disponible.</p>
        </div>
      )
    }

    if (estado === 'cancelado') {
      return (
        <>
          <div className="w-full rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--danger)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Turno cancelado</p>
              <p className="text-xs opacity-75" style={{ color: 'var(--danger)' }}>Tu horario quedó liberado.</p>
            </div>
          </div>
          {detalleCard}
          {pagado && (
            <div className="w-full rounded-xl px-4 py-3" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)' }}>
              <p className="text-sm" style={{ color: 'var(--warn)' }}>
                Tu turno ya está abonado. Tu profesional se va a comunicar con vos para resolver el pago.
              </p>
            </div>
          )}
        </>
      )
    }

    if (pasoCancelar) {
      return (
        <>
          {detalleCard}
          <div className="w-full card p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <p className="text-sm font-semibold text-center" style={{ color: 'var(--ink)' }}>¿Seguro que querés cancelar?</p>
            {pagado && (
              <p className="text-sm text-center" style={{ color: 'var(--warn)' }}>
                Tu turno ya está abonado. Si cancelás, tu profesional se va a comunicar con vos para resolver el pago.
              </p>
            )}
            {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setPasoCancelar(false)}
                disabled={loading !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                Volver
              </button>
              <button
                onClick={() => llamarApi('cancelar')}
                disabled={loading !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--danger)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading === 'cancelar' ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        {detalleCard}
        {estado === 'confirmado' && (
          <div className="w-full rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--ok-soft)', border: '1px solid var(--ok)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--ok)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>Ya confirmaste este turno</p>
          </div>
        )}
        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="w-full card p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          {estado === 'pendiente' && (
            <button
              onClick={() => llamarApi('confirmar')}
              disabled={loading !== null}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{
                background: 'var(--ink)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: destacarConfirmar ? '0 0 0 3px var(--accent-soft)' : undefined,
              }}
            >
              {loading === 'confirmar' ? 'Confirmando…' : 'Confirmar turno'}
            </button>
          )}
          <button
            onClick={() => setPasoCancelar(true)}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Cancelar turno
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F6FA' }}>
      <header className="flex items-center justify-center py-5" style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="KLIA" style={{ height: 28, width: 'auto' }} />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-4 w-full" style={{ maxWidth: 440, margin: '0 auto' }}>
        {renderContenido()}
      </main>

      <footer className="text-center py-6 text-xs space-x-3" style={{ color: 'var(--muted-2)' }}>
        <a href="/privacidad" className="hover:underline">Privacidad</a>
        <span>·</span>
        <a href="/terminos" className="hover:underline">Términos</a>
      </footer>
    </div>
  )
}
