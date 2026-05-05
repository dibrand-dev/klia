'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Logo from '@/components/ui/Logo'

const CheckoutBrick = dynamic(() => import('@/components/suscripcion/CheckoutBrick'), { ssr: false })

type Periodo = 'mensual' | 'anual'

type SelectedPlan = {
  id: string
  nombre: string
  preferenceId: string
  monto: number
  modalidad: Periodo
}

const PLANES = [
  {
    id: 'esencial',
    nombre: 'Esencial',
    descripcion: 'Para profesionales que empiezan',
    mensual: 15000,
    anual: 13750,
    color: 'border-outline-variant/30',
    btnCls: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
    funcionalidades: [
      { texto: 'Hasta 30 pacientes activos', incluido: true },
      { texto: 'Agenda y turnos', incluido: true },
      { texto: 'Historial clínico básico', incluido: true },
      { texto: 'Notas de sesión', incluido: true },
      { texto: 'Facturación manual', incluido: true },
      { texto: 'Turnos recurrentes', incluido: false },
      { texto: 'Obras sociales', incluido: false },
      { texto: 'Interconsultas', incluido: false },
      { texto: 'Informes y estadísticas', incluido: false },
      { texto: 'Soporte prioritario', incluido: false },
    ],
  },
  {
    id: 'profesional',
    nombre: 'Profesional',
    descripcion: 'Para la práctica en crecimiento',
    mensual: 28000,
    anual: 25667,
    destacado: true,
    color: 'border-primary',
    btnCls: 'bg-primary text-white hover:bg-primary/90',
    funcionalidades: [
      { texto: 'Pacientes ilimitados', incluido: true },
      { texto: 'Agenda y turnos', incluido: true },
      { texto: 'Historial clínico completo', incluido: true },
      { texto: 'Notas de sesión', incluido: true },
      { texto: 'Facturación manual', incluido: true },
      { texto: 'Turnos recurrentes', incluido: true },
      { texto: 'Obras sociales', incluido: true },
      { texto: 'Interconsultas', incluido: true },
      { texto: 'Informes y estadísticas', incluido: false },
      { texto: 'Soporte prioritario', incluido: false },
    ],
  },
  {
    id: 'premium',
    nombre: 'Premium',
    descripcion: 'Para consultorios exigentes',
    mensual: 42000,
    anual: 38500,
    color: 'border-purple-400',
    btnCls: 'bg-purple-600 text-white hover:bg-purple-700',
    funcionalidades: [
      { texto: 'Pacientes ilimitados', incluido: true },
      { texto: 'Agenda y turnos', incluido: true },
      { texto: 'Historial clínico completo', incluido: true },
      { texto: 'Notas de sesión', incluido: true },
      { texto: 'Facturación manual', incluido: true },
      { texto: 'Turnos recurrentes', incluido: true },
      { texto: 'Obras sociales', incluido: true },
      { texto: 'Interconsultas', incluido: true },
      { texto: 'Informes y estadísticas', incluido: true },
      { texto: 'Soporte prioritario', incluido: true },
    ],
  },
]

function formatPrecio(n: number) {
  return '$' + n.toLocaleString('es-AR')
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block mr-1.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function PlanesClient({ mpPublicKey }: { mpPublicKey: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedPlan | null>(null)

  async function handleElegir(planId: string, planNombre: string) {
    setLoading(planId)
    setError(null)
    try {
      const res = await fetch('/api/suscripcion/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, modalidad: periodo }),
      })
      const data = await res.json()
      if (!res.ok || !data.preference_id) throw new Error(data.error ?? 'Error')
      setSelected({
        id: planId,
        nombre: planNombre,
        preferenceId: data.preference_id,
        monto: data.monto,
        modalidad: periodo,
      })
    } catch {
      setError('No pudimos conectar con Mercado Pago. Intentá nuevamente.')
    } finally {
      setLoading(null)
    }
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-surface-container-lowest">
        <div className="bg-white border-b border-outline-variant/20 px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <Logo className="h-8 w-auto" />
          </Link>
        </div>

        <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Cambiar plan
          </button>

          <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-on-surface">Plan {selected.nombre}</p>
              <p className="text-sm text-on-surface-variant capitalize">{selected.modalidad}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-on-surface">{formatPrecio(selected.monto)}</p>
              <p className="text-xs text-on-surface-variant">/mes</p>
            </div>
          </div>

          <CheckoutBrick
            preferenceId={selected.preferenceId}
            monto={selected.monto}
            plan={selected.id}
            modalidad={selected.modalidad}
            publicKey={mpPublicKey}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <div className="bg-white border-b border-outline-variant/20 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <span
            className="material-symbols-outlined text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            medical_services
          </span>
          <span className="font-bold text-xl tracking-tighter">KLIA</span>
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Elegí tu plan</h1>
          <p className="text-on-surface-variant">Sin contratos. Cancelá cuando quieras.</p>
        </div>

        <div className="flex items-center justify-center">
          <div className="inline-flex bg-surface-container rounded-xl p-1 gap-1">
            <button
              onClick={() => setPeriodo('mensual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                periodo === 'mensual'
                  ? 'bg-white shadow-sm text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setPeriodo('anual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                periodo === 'anual'
                  ? 'bg-white shadow-sm text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Anual
              <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                1 mes gratis
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANES.map((plan) => {
            const precio = periodo === 'mensual' ? plan.mensual : plan.anual
            const isLoading = loading === plan.id

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 ${plan.color} shadow-sm flex flex-col`}
              >
                {plan.destacado && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Más popular
                    </span>
                  </div>
                )}

                <div className="p-6 space-y-1">
                  <p className="font-bold text-lg text-on-surface">{plan.nombre}</p>
                  <p className="text-xs text-on-surface-variant">{plan.descripcion}</p>
                </div>

                <div className="px-6 pb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-on-surface">{formatPrecio(precio)}</span>
                    <span className="text-sm text-on-surface-variant mb-1">/mes</span>
                  </div>
                  {periodo === 'anual' && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Facturado anualmente · {formatPrecio(plan.anual * 12)}/año
                    </p>
                  )}
                </div>

                <div className="px-6 pb-6 flex-1 space-y-2.5">
                  {plan.funcionalidades.map((f) => (
                    <div key={f.texto} className="flex items-start gap-2">
                      {f.incluido ? (
                        <span
                          className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-outline-variant text-base mt-0.5 shrink-0">
                          cancel
                        </span>
                      )}
                      <span className={`text-sm ${f.incluido ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                        {f.texto}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-6">
                  <button
                    onClick={() => handleElegir(plan.id, plan.nombre)}
                    disabled={loading !== null}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${plan.btnCls} disabled:opacity-70`}
                  >
                    {isLoading ? (
                      <>
                        <Spinner />
                        Procesando…
                      </>
                    ) : (
                      'Elegir'
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-on-surface-variant">
          Precios en pesos argentinos. Incluye IVA.{' '}
          <a href="mailto:hola@klia.ar" className="underline hover:text-on-surface">
            ¿Tenés dudas? Escribinos.
          </a>
        </p>
      </div>
    </div>
  )
}
