'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
type ModuloItem = {
  modulo_id: string
  nombre: string
  descripcion: string | null
  planes: string[]
}

type PrecioPlan = { precio_mensual: number; precio_anual_mensual: number | null }

// Nunca coercionar null/undefined a 0 — un precio ausente es un bug de datos/RLS
// que tiene que verse, no esconderse como "$0" (ver diagnóstico del bug del $0).
function fmt(n: number | null | undefined) {
  return n == null ? '—' : n.toLocaleString('es-AR')
}

const CHECK = (
  <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="3" fill="none">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const CROSS = (
  <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="3" fill="none">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
  )
}

export default function PlanesSection({ modulos, precios }: { modulos: ModuloItem[]; precios: Record<string, PrecioPlan> }) {
  const router = useRouter()
  const [ciclo, setCiclo] = useState<'mensual' | 'anual'>('mensual')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [codigoInput, setCodigoInput] = useState('')
  const [codigoLoading, setCodigoLoading] = useState(false)
  const [codigoError, setCodigoError] = useState<string | null>(null)
  const [codigoAplicado, setCodigoAplicado] = useState<number | null>(null)

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
      setCodigoAplicado(data.porcentaje_descuento ?? null)
    } catch (err) {
      setCodigoError(err instanceof Error ? err.message : 'No se pudo aplicar el código.')
    } finally {
      setCodigoLoading(false)
    }
  }

  const p = (plan: string) =>
    ciclo === 'mensual' ? precios[plan]?.precio_mensual : precios[plan]?.precio_anual_mensual

  // Mismo cálculo que getMonto en src/lib/mercadopago.ts — no reinventar la fórmula.
  const precioConDescuento = (plan: string) => {
    const base = p(plan)
    if (base == null || codigoAplicado == null) return null
    return Math.round(base * (1 - codigoAplicado / 100))
  }

  async function handleElegirPlan(plan: string) {
    setLoadingPlan(plan)
    setError(null)
    try {
      const res = await fetch('/api/suscripcion/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, modalidad: ciclo }),
      })
      const data = await res.json() as { preference_id?: string; monto?: number; error?: string }
      if (!res.ok || !data.preference_id) throw new Error(data.error ?? 'Error al conectar con Mercado Pago')
      router.push(`/checkout?preference_id=${data.preference_id}&plan=${plan}&monto=${data.monto}&modalidad=${ciclo}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos conectar con Mercado Pago. Intentá nuevamente.')
      setLoadingPlan(null)
    }
  }

  const renderPrecio = (plan: string) => {
    const descontado = precioConDescuento(plan)
    if (descontado == null) {
      return <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.025em', color: '#0B1220', lineHeight: 1 }}>{fmt(p(plan))}</span>
    }
    return (
      <>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#AEB5C0', textDecoration: 'line-through', lineHeight: 1 }}>{fmt(p(plan))}</span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.025em', color: '#0E8A5F', lineHeight: 1 }}>{fmt(descontado)}</span>
      </>
    )
  }

  const renderModulos = (planId: string) =>
    modulos.map((m) => {
      const incluido = m.planes.includes(planId)
      return (
        <li key={m.modulo_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: incluido ? '#1F2937' : '#AEB5C0', lineHeight: 1.5, textDecoration: incluido ? 'none' : 'line-through' }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: incluido ? '#EEF2FF' : '#F3F4F6', color: incluido ? '#4F46E5' : '#9CA3AF', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
            {incluido ? CHECK : CROSS}
          </span>
          <span>{m.nombre}</span>
        </li>
      )
    })

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .plans-grid { grid-template-columns: 1fr !important; max-width: 480px !important; } }
      `}</style>

      {/* Billing toggle */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          Elegí tu plan
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 100, background: '#fff', border: '1px solid #E7E9EE', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
          <button
            onClick={() => setCiclo('mensual')}
            style={{ padding: '9px 20px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 500, background: ciclo === 'mensual' ? '#0B1220' : 'transparent', color: ciclo === 'mensual' ? 'white' : '#5B6472', transition: 'all .2s' }}
          >
            Mensual
          </button>
          <button
            onClick={() => setCiclo('anual')}
            style={{ padding: '9px 20px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, background: ciclo === 'anual' ? '#0B1220' : 'transparent', color: ciclo === 'anual' ? 'white' : '#5B6472', transition: 'all .2s' }}
          >
            Anual
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 100, background: ciclo === 'anual' ? 'rgba(255,255,255,0.18)' : '#E7F5EE', color: ciclo === 'anual' ? 'white' : '#0E8A5F', fontSize: 10.5, fontWeight: 700 }}>
              2 meses gratis
            </span>
          </button>
        </div>
      </div>

      {/* Código de descuento institucional */}
      <div style={{ maxWidth: 420, margin: '0 auto 24px' }}>
        {codigoAplicado != null ? (
          <div style={{ padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, fontSize: 13, color: '#0E8A5F', textAlign: 'center', fontWeight: 600 }}>
            ✓ Descuento del {codigoAplicado}% aplicado — se reflejará al confirmar tu plan
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                placeholder="¿Tenés un código de descuento?"
                disabled={codigoLoading}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E7E9EE', fontSize: 13.5 }}
              />
              <button
                onClick={handleAplicarCodigo}
                disabled={codigoLoading || !codigoInput.trim()}
                style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: '1px solid #E7E9EE', background: '#fff', color: '#1F2937', cursor: codigoLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {codigoLoading ? 'Validando…' : 'Aplicar'}
              </button>
            </div>
            {codigoError && (
              <p style={{ fontSize: 12.5, color: '#BE3144', marginTop: 6, textAlign: 'center' }}>{codigoError}</p>
            )}
          </>
        )}
      </div>

      {error && (
        <div style={{ maxWidth: 560, margin: '0 auto 20px', padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#BE3144', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 1080, margin: '0 auto' }}>

        {/* ESENCIAL */}
        <article style={{ background: '#fff', border: '1px solid #E7E9EE', borderRadius: 18, padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#AEB5C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Para empezar</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Esencial</h3>
          <p style={{ fontSize: 13, color: '#5B6472', marginBottom: 18, minHeight: 36 }}>Para profesionales independientes que recién empiezan a digitalizar.</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1F2937' }}>$</span>
            {renderPrecio('esencial')}
            <span style={{ fontSize: 13.5, color: '#5B6472', fontWeight: 500 }}>/mes</span>
          </div>
          <div style={{ fontSize: 12, color: '#AEB5C0', marginBottom: 20, minHeight: 18 }}>
            {ciclo === 'anual' ? <b style={{ color: '#0E8A5F' }}>Ahorrás 2 meses</b> : 'Facturación mensual'}
          </div>
          <div style={{ marginBottom: 22 }}>
            <button
              onClick={() => handleElegirPlan('esencial')}
              disabled={loadingPlan !== null}
              style={{ display: 'block', width: '100%', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loadingPlan ? 'not-allowed' : 'pointer', border: '1px solid #E7E9EE', background: '#fff', color: '#1F2937', textAlign: 'center', opacity: loadingPlan && loadingPlan !== 'esencial' ? 0.5 : 1 }}
            >
              {loadingPlan === 'esencial' ? <><Spinner />Procesando…</> : 'Elegir Esencial'}
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #E7E9EE', paddingTop: 20, flex: 1 }}>
            {renderModulos('esencial')}
          </ul>
        </article>

        {/* PROFESIONAL (featured) */}
        <article style={{ background: 'radial-gradient(circle at 100% 0%, rgba(79,70,229,0.06) 0%, transparent 50%), #fff', border: '1px solid #4F46E5', borderRadius: 18, padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 18px 38px rgba(79,70,229,0.10)', transform: 'translateY(-4px)' }}>
          <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', color: 'white', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 100, whiteSpace: 'nowrap', boxShadow: '0 12px 28px rgba(79,70,229,.18)' }}>
            ★ Más popular
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>El más elegido</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Profesional</h3>
          <p style={{ fontSize: 13, color: '#5B6472', marginBottom: 18, minHeight: 36 }}>Para consultorios que necesitan IA, facturación y reportes clínicos.</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1F2937' }}>$</span>
            {renderPrecio('profesional')}
            <span style={{ fontSize: 13.5, color: '#5B6472', fontWeight: 500 }}>/mes</span>
          </div>
          <div style={{ fontSize: 12, color: '#AEB5C0', marginBottom: 20, minHeight: 18 }}>
            {ciclo === 'anual' ? <b style={{ color: '#0E8A5F' }}>Ahorrás 2 meses</b> : 'Facturación mensual'}
          </div>
          <div style={{ marginBottom: 22 }}>
            <button
              onClick={() => handleElegirPlan('profesional')}
              disabled={loadingPlan !== null}
              style={{ display: 'flex', width: '100%', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loadingPlan ? 'not-allowed' : 'pointer', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', color: 'white', textAlign: 'center', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 12px 28px rgba(79,70,229,.18)', opacity: loadingPlan && loadingPlan !== 'profesional' ? 0.5 : 1 }}
            >
              {loadingPlan === 'profesional' ? (
                <><Spinner />Procesando…</>
              ) : (
                <>
                  Elegir Profesional
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" strokeWidth="2" fill="none"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </>
              )}
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #E7E9EE', paddingTop: 20, flex: 1 }}>
            {renderModulos('profesional')}
          </ul>
        </article>

        {/* PREMIUM */}
        <article style={{ background: '#fff', border: '1px solid #E7E9EE', borderRadius: 18, padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#AEB5C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Para centros y equipos</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Premium</h3>
          <p style={{ fontSize: 13, color: '#5B6472', marginBottom: 18, minHeight: 36 }}>Para centros de salud con varios profesionales y altas exigencias.</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1F2937' }}>$</span>
            {renderPrecio('premium')}
            <span style={{ fontSize: 13.5, color: '#5B6472', fontWeight: 500 }}>/mes</span>
          </div>
          <div style={{ fontSize: 12, color: '#AEB5C0', marginBottom: 20, minHeight: 18 }}>
            {ciclo === 'anual' ? <b style={{ color: '#0E8A5F' }}>Ahorrás 2 meses</b> : 'Facturación mensual'}
          </div>
          <div style={{ marginBottom: 22 }}>
            <button
              onClick={() => handleElegirPlan('premium')}
              disabled={loadingPlan !== null}
              style={{ display: 'block', width: '100%', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loadingPlan ? 'not-allowed' : 'pointer', border: '1px solid #E7E9EE', background: '#fff', color: '#1F2937', textAlign: 'center', opacity: loadingPlan && loadingPlan !== 'premium' ? 0.5 : 1 }}
            >
              {loadingPlan === 'premium' ? <><Spinner />Procesando…</> : 'Elegir Premium'}
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #E7E9EE', paddingTop: 20, flex: 1 }}>
            {renderModulos('premium')}
          </ul>
        </article>

      </div>
    </>
  )
}
