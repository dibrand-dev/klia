'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function IntegracionesClient({
  conectado,
  syncEnabled,
}: {
  conectado: boolean
  syncEnabled: boolean
}) {
  const searchParams = useSearchParams()
  const googleParam = searchParams.get('google')
  const router = useRouter()

  const [sync, setSync] = useState(syncEnabled)

  useEffect(() => {
    if (googleParam === 'connected') {
      router.refresh()
    }
  }, [])
  const [desconectando, setDesconectando] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(
    googleParam === 'error' ? 'No se pudo conectar con Google Calendar. Intentá de nuevo.' : null
  )
  const [exito] = useState(googleParam === 'connected')

  async function toggleSync() {
    const nuevo = !sync
    setSync(nuevo)
    await fetch('/api/google-calendar/toggle-sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_enabled: nuevo }),
    }).catch(() => setSync(!nuevo))
  }

  async function desconectar() {
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

  return (
    <div className="space-y-4">
      {(error || exito) && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${
          exito
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {exito ? 'Google Calendar conectado correctamente.' : error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-outline-variant/20 flex items-center justify-center shadow-sm shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285F4" strokeWidth="1.5" />
                <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5" />
                <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#EA4335" />
                <rect x="11" y="13" width="3" height="3" rx="0.5" fill="#FBBC04" />
                <rect x="15" y="13" width="2" height="3" rx="0.5" fill="#34A853" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-on-surface">Google Calendar</p>
              {conectado ? (
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium mt-0.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Conectado
                </span>
              ) : (
                <span className="text-xs text-on-surface-variant mt-0.5 block">No conectado</span>
              )}
            </div>
          </div>
        </div>

        {conectado ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              Los turnos de KLIA aparecen en tu Google Calendar automáticamente.
              Los horarios ocupados se muestran en tu agenda y no podés crear turnos encima.
            </p>

            <div className="flex items-center justify-between py-3 border-t border-outline-variant/10">
              <div>
                <p className="text-sm font-medium text-on-surface">Sincronización activa</p>
                <p className="text-xs text-on-surface-variant">Los nuevos turnos se sincronizan automáticamente</p>
              </div>
              <button
                onClick={toggleSync}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  sync ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    sync ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={desconectando}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-60"
            >
              {desconectando ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Sincronizá tus turnos con Google Calendar y bloqueá automáticamente
              los horarios que ya tenés ocupados.
            </p>
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-base">link</span>
              Conectar Google Calendar
            </a>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Desconectar Google Calendar"
        message="Los turnos ya creados en Google no se eliminarán. ¿Querés continuar?"
        confirmLabel="Desconectar"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); desconectar() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
