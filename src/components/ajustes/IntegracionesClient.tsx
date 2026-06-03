'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function IntegracionesClient({
  conectado,
  syncEnabled,
  mpConectado,
  mpEmail,
  mpNombre,
}: {
  conectado: boolean
  syncEnabled: boolean
  mpConectado: boolean
  mpEmail: string | null
  mpNombre: string | null
}) {
  const searchParams = useSearchParams()
  const googleParam = searchParams.get('google')
  const mpParam = searchParams.get('mp')
  const router = useRouter()

  const [sync, setSync] = useState(syncEnabled)
  const [desconectando, setDesconectando] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [mpDesconectando, setMpDesconectando] = useState(false)
  const [mpConfirmOpen, setMpConfirmOpen] = useState(false)
  const [mpActualConectado, setMpActualConectado] = useState(mpConectado)
  const [mpActualEmail, setMpActualEmail] = useState(mpEmail)
  const [mpActualNombre, setMpActualNombre] = useState(mpNombre)
  const [error, setError] = useState<string | null>(
    googleParam === 'error' ? 'No se pudo conectar con Google Calendar. Intentá de nuevo.' :
    mpParam === 'error' ? 'No se pudo conectar con Mercado Pago. Intentá de nuevo.' : null
  )

  useEffect(() => {
    if (googleParam === 'connected' || mpParam === 'connected') {
      router.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync MP state when props update after router.refresh()
  useEffect(() => { setMpActualConectado(mpConectado) }, [mpConectado])
  useEffect(() => { setMpActualEmail(mpEmail) }, [mpEmail])
  useEffect(() => { setMpActualNombre(mpNombre) }, [mpNombre])

  async function toggleSync() {
    const nuevo = !sync
    setSync(nuevo)
    await fetch('/api/google-calendar/toggle-sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_enabled: nuevo }),
    }).catch(() => setSync(!nuevo))
  }

  async function desconectarGoogle() {
    setDesconectando(true)
    setError(null)
    try {
      const res = await fetch('/api/google-calendar/disconnect', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      window.location.reload()
    } catch {
      setError('Error al desconectar. Intentá de nuevo.')
      setDesconectando(false)
    }
  }

  async function desconectarMP() {
    setMpDesconectando(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mercadopago/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error()
      setMpActualConectado(false)
      setMpActualEmail(null)
      setMpActualNombre(null)
      router.refresh()
    } catch {
      setError('Error al desconectar Mercado Pago. Intentá de nuevo.')
    } finally {
      setMpDesconectando(false)
    }
  }

  // ── Integration card wrapper ──────────────────────────────────────
  const intStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '16px 18px',
    border: '1px solid var(--border)', borderRadius: 12,
    background: 'var(--surface)', marginBottom: 12,
  }
  const logoStyle: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
    display: 'grid', placeItems: 'center',
    border: '1px solid var(--border)', background: 'var(--surface)',
  }
  const statusOn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 9px', borderRadius: 100,
    fontSize: 11, fontWeight: 600,
    background: 'var(--ok-soft)', color: 'var(--ok)',
  }
  const statusOff: React.CSSProperties = {
    ...statusOn, background: 'var(--surface-3)', color: 'var(--muted)',
  }
  const dot: React.CSSProperties = {
    width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block',
  }

  return (
    <div>
      {error && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {(googleParam === 'connected') && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: 'var(--ok-soft)', border: '1px solid var(--ok)', color: 'var(--ok)' }}>
          Google Calendar conectado correctamente.
        </div>
      )}
      {mpParam === 'connected' && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: 'var(--ok-soft)', border: '1px solid var(--ok)', color: 'var(--ok)' }}>
          Mercado Pago conectado correctamente.
        </div>
      )}

      {/* ── Google Calendar ── */}
      <div style={intStyle}>
        <div style={logoStyle}>
          <img src="/google-calendar.svg" alt="Google Calendar" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>Google Calendar</span>
            <span style={conectado ? statusOn : statusOff}>
              <span style={dot} />{conectado ? 'Conectado' : 'No conectado'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.55 }}>
            Los turnos de KLIA aparecen automáticamente en tu Google Calendar. La sincronización es bidireccional. <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>También habilita Google Drive</strong> para guardar archivos de pacientes.
          </p>
          {conectado ? (
            <div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>
                  <strong>Actualizá tu conexión</strong> para habilitar la subida de archivos al módulo de Archivos.{' '}
                  <button
                    onClick={desconectarGoogle}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', textDecoration: 'underline', fontWeight: 600, fontSize: 12.5 }}
                  >
                    Reconectar Google
                  </button>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Sincronización activa</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Los nuevos turnos se sincronizan automáticamente</p>
                </div>
                <button onClick={toggleSync} style={{
                  position: 'relative', width: 38, height: 22, flexShrink: 0,
                  background: sync ? 'var(--ink)' : 'var(--border-strong)',
                  borderRadius: 100, cursor: 'pointer', border: 'none',
                  transition: 'background .15s ease',
                }}>
                  <span style={{ position: 'absolute', top: 2, left: sync ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', display: 'block' }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                <button onClick={() => setConfirmOpen(true)} disabled={desconectando}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', opacity: desconectando ? 0.6 : 1 }}>
                  {desconectando ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.55 }}>
                Sincronizá tus turnos con Google Calendar y bloqueá automáticamente los horarios que ya tenés ocupados.
              </p>
              <a href="/api/auth/google" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                background: 'linear-gradient(135deg, var(--accent) 0%, #1D4ED8 100%)',
                color: 'white', border: 'none', textDecoration: 'none',
                boxShadow: '0 4px 10px rgba(37,99,235,0.18)',
              }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'white', strokeWidth: 2, fill: 'none' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                Conectar Google Calendar
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Mercado Pago ── */}
      <div style={{ ...intStyle, marginBottom: 0 }}>
        <div style={{ ...logoStyle }}>
          <img src="/logo-mercado-pago.png" alt="Mercado Pago" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>Mercado Pago</span>
            <span style={mpActualConectado ? statusOn : statusOff}>
              <span style={dot} />{mpActualConectado ? 'Conectado' : 'No conectado'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.55 }}>
            Tus pacientes pueden pagar sesiones directamente a tu cuenta. <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>El dinero entra al instante</strong> — KLIA no retiene fondos.
          </p>
          {mpActualConectado ? (
            <div>
              {(mpActualNombre || mpActualEmail) && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 8, padding: '4px 10px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 100, fontSize: 12, color: 'var(--ink-2)',
                }}>
                  <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: 'var(--muted)', strokeWidth: 1.8, fill: 'none' }}>
                    <path d="M3 7h18v10H3z"/><path d="M3 11h18"/>
                  </svg>
                  {mpActualNombre && <strong style={{ fontWeight: 600 }}>{mpActualNombre}</strong>}
                  {mpActualEmail && <span style={{ color: 'var(--muted)' }}>· {mpActualEmail}</span>}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setMpConfirmOpen(true)} disabled={mpDesconectando}
                  style={{ background: 'transparent', border: 'none', color: '#DC2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0, opacity: mpDesconectando ? 0.6 : 1 }}>
                  {mpDesconectando ? 'Desconectando…' : 'Desconectar cuenta'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.55 }}>
                Conectá tu cuenta de Mercado Pago para que tus pacientes puedan pagar sesiones desde el link público.
              </p>
              <a href="/api/auth/mercadopago" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                background: '#009EE3', color: 'white', border: 'none', textDecoration: 'none',
                boxShadow: '0 4px 10px rgba(0,158,227,0.22)',
              }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'white', strokeWidth: 2, fill: 'none' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                Conectar Mercado Pago
              </a>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Desconectar Google Calendar"
        message="Los turnos ya creados en Google no se eliminarán. ¿Querés continuar?"
        confirmLabel="Desconectar"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); desconectarGoogle() }}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={mpConfirmOpen}
        title="Desconectar Mercado Pago"
        message="Los pacientes ya no podrán pagar desde tu link público. Podés volver a conectarlo cuando quieras. ¿Confirmás?"
        confirmLabel="Desconectar"
        variant="danger"
        onConfirm={() => { setMpConfirmOpen(false); desconectarMP() }}
        onCancel={() => setMpConfirmOpen(false)}
      />
    </div>
  )
}
