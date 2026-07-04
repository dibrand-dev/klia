'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

const NOMBRE_PLAN: Record<string, string> = {
  esencial: 'Esencial',
  profesional: 'Profesional',
  premium: 'Premium',
  bonificado: 'Bonificado',
}

type Profile = {
  estado_cuenta: 'trial' | 'activa' | 'bloqueada' | 'cancelada'
  plan: string
  trial_fin: string
  suscripcion_fin: string | null
}

type Suscripcion = {
  estado: string
  plan: string
  modalidad: 'mensual' | 'anual'
  suscripcion_fin: string | null
  mp_preapproval_id: string | null
  monto: number
} | null

function formatFecha(iso: string) {
  return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es })
}

function formatPrecio(n: number) {
  return '$' + n.toLocaleString('es-AR')
}

export default function SuscripcionPortal({
  profile,
  suscripcion,
  codigoDescuento,
}: {
  profile: Profile
  suscripcion: Suscripcion
  codigoDescuento?: { colegioNombre: string; porcentaje: number } | null
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [accesoHasta, setAccesoHasta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [codigoInput, setCodigoInput] = useState('')
  const [codigoLoading, setCodigoLoading] = useState(false)
  const [codigoError, setCodigoError] = useState<string | null>(null)
  const [codigoAplicadoLocal, setCodigoAplicadoLocal] = useState<number | null>(null)

  async function handleAplicarCodigo() {
    if (!codigoInput.trim()) return
    setCodigoLoading(true)
    setCodigoError(null)
    try {
      const res = await fetch('/api/codigo-descuento/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoInput.trim() }),
      })
      const data = await res.json() as { ok?: boolean; porcentaje_descuento?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo aplicar el código.')
      setCodigoAplicadoLocal(data.porcentaje_descuento ?? null)
    } catch (err) {
      setCodigoError(err instanceof Error ? err.message : 'No se pudo aplicar el código.')
    } finally {
      setCodigoLoading(false)
    }
  }

  async function handleCancelar() {
    setCancelando(true)
    setError(null)
    try {
      const res = await fetch('/api/suscripcion/cancelar', { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar')
      setAccesoHasta(data.acceso_hasta)
      setCancelado(true)
      setConfirmando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelando(false)
    }
  }

  // ── Plan bonificado ──────────────────────────────────────────────────────
  if (profile.plan === 'bonificado') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
          <p className="font-semibold text-on-surface">Plan actual</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-on-surface">Plan Bonificado</p>
            </div>
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Activo
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            Tu acceso fue otorgado por el equipo de KLIA. Para consultas escribí a{' '}
            <a href="mailto:hola@klia.com.ar" className="text-primary underline">hola@klia.com.ar</a>
          </p>
        </div>
      </div>
    )
  }

  // ── Trial ────────────────────────────────────────────────────────────────
  if (profile.estado_cuenta === 'trial') {
    const diasRestantes = Math.max(0, differenceInDays(parseISO(profile.trial_fin), new Date()))
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
          <p className="font-semibold text-on-surface">Plan actual</p>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            <div>
              <p className="font-bold text-on-surface">Estás en período de prueba</p>
              <p className="text-sm text-on-surface-variant">
                Te {diasRestantes === 1 ? 'queda' : 'quedan'}{' '}
                <strong>{diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}</strong> de tu prueba gratuita de 21 días — Plan Premium completo.
              </p>
            </div>
          </div>
          <Link
            href="/planes"
            className="inline-block mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Contratar un plan
          </Link>
        </div>
      </div>
    )
  }

  // ── Bloqueada ────────────────────────────────────────────────────────────
  if (profile.estado_cuenta === 'bloqueada') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-3">
          <p className="font-semibold text-on-surface">Plan actual</p>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-error" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
            <div>
              <p className="font-bold text-on-surface">Tu cuenta está inactiva</p>
              <p className="text-sm text-on-surface-variant">
                Tu período de prueba venció o tu suscripción fue cancelada.
              </p>
            </div>
          </div>
          <Link
            href="/planes"
            className="inline-block mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver planes y contratar
          </Link>
        </div>
      </div>
    )
  }

  // ── Suscripción activa ───────────────────────────────────────────────────
  const proximoCobro = suscripcion?.suscripcion_fin ? formatFecha(suscripcion.suscripcion_fin) : null
  const fechaFinAcceso = (suscripcion?.suscripcion_fin ?? profile.suscripcion_fin)
    ? formatFecha((suscripcion?.suscripcion_fin ?? profile.suscripcion_fin)!)
    : null

  if (cancelado) {
    return (
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
          <div>
            <p className="font-bold text-on-surface">Suscripción cancelada</p>
            {accesoHasta && (
              <p className="text-sm text-on-surface-variant">
                Seguís teniendo acceso hasta el <strong>{formatFecha(accesoHasta)}</strong>.
              </p>
            )}
          </div>
        </div>
        <Link href="/planes" className="inline-block mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          Ver planes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Plan actual */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-4">
        <p className="font-semibold text-on-surface">Plan actual</p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-on-surface">
              Plan {NOMBRE_PLAN[suscripcion?.plan ?? profile.plan] ?? suscripcion?.plan ?? profile.plan}
            </p>
            {suscripcion && (
              <p className="text-sm text-on-surface-variant">
                {formatPrecio(suscripcion.monto)} ARS / mes
              </p>
            )}
            {proximoCobro && (
              <p className="text-sm text-on-surface-variant">
                Próximo cobro: {proximoCobro}
              </p>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full shrink-0">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Activo
          </span>
        </div>
        <Link
          href="/planes"
          className="inline-block px-5 py-2.5 border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors"
        >
          Cambiar plan
        </Link>
      </div>

      {/* Código de descuento institucional */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
        <p className="font-semibold text-on-surface">Código de descuento</p>
        {codigoDescuento ? (
          <p className="text-sm text-on-surface-variant">
            Tenés aplicado un descuento del <strong>{codigoDescuento.porcentaje}%</strong> por convenio con{' '}
            <strong>{codigoDescuento.colegioNombre}</strong>.
          </p>
        ) : codigoAplicadoLocal != null ? (
          <p className="text-sm font-medium text-green-700">
            ✓ Descuento del {codigoAplicadoLocal}% aplicado. Se reflejará en tu próximo cobro.
          </p>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">
              Si tu colegio profesional tiene un convenio con KLIA, ingresá el código para aplicar el descuento a tu suscripción.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                placeholder="Código de descuento"
                disabled={codigoLoading}
                className="flex-1 input-field"
              />
              <button
                onClick={handleAplicarCodigo}
                disabled={codigoLoading || !codigoInput.trim()}
                className="px-5 py-2.5 border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-60"
              >
                {codigoLoading ? 'Validando…' : 'Aplicar'}
              </button>
            </div>
            {codigoError && <p className="text-sm text-red-600">{codigoError}</p>}
          </>
        )}
      </div>

      {/* Método de pago */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
        <p className="font-semibold text-on-surface">Método de pago</p>
        <p className="text-sm text-on-surface-variant">
          Tu método de pago se gestiona desde Mercado Pago. Si necesitás actualizar
          tu tarjeta, podés hacerlo desde tu cuenta de Mercado Pago.
        </p>
        <a
          href="https://www.mercadopago.com.ar/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors"
        >
          Ir a Mercado Pago
          <span className="material-symbols-outlined text-base">open_in_new</span>
        </a>
      </div>

      {/* Cancelar suscripción */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-3">
        <p className="font-semibold text-on-surface">Cancelar suscripción</p>

        {!confirmando ? (
          <>
            <p className="text-sm text-on-surface-variant">
              Si cancelás tu suscripción, seguirás teniendo acceso a KLIA
              {fechaFinAcceso ? <> hasta el <strong>{fechaFinAcceso}</strong></> : ''}.
              Después de esa fecha tu cuenta quedará inactiva.
            </p>
            <button
              onClick={() => setConfirmando(true)}
              className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Cancelar suscripción
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-on-surface">
              ¿Confirmás que querés cancelar tu suscripción?
              {fechaFinAcceso && (
                <> Seguirás teniendo acceso hasta el <strong>{fechaFinAcceso}</strong>.
                Después tu cuenta quedará inactiva.</>
              )}
            </p>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={cancelando}
                className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-60"
              >
                No, mantener suscripción
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelando}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
