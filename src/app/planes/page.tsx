'use client'

import { useState } from 'react'
import Link from 'next/link'

type Periodo = 'mensual' | 'anual'

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

export default function PlanesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [elegido, setElegido] = useState<string | null>(null)

  function handleElegir(planId: string) {
    setElegido(planId)
    // TODO: integrar Mercado Pago — crear preferencia de pago con plan y periodo seleccionado
    setTimeout(() => setElegido(null), 3000)
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      {/* Header */}
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
        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Elegí tu plan</h1>
          <p className="text-on-surface-variant">Sin contratos. Cancelá cuando quieras.</p>
        </div>

        {/* Toggle mensual / anual */}
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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANES.map((plan) => {
            const precio = periodo === 'mensual' ? plan.mensual : plan.anual
            const isElegido = elegido === plan.id

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

                <div className="px-6 pb-6 space-y-2">
                  <button
                    onClick={() => handleElegir(plan.id)}
                    disabled={isElegido}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${plan.btnCls} disabled:opacity-80`}
                  >
                    {isElegido ? (
                      <>
                        <Spinner />
                        Próximamente…
                      </>
                    ) : (
                      'Elegir'
                    )}
                  </button>
                  {isElegido && (
                    <p className="text-center text-xs text-on-surface-variant">
                      Integrando Mercado Pago — te avisamos cuando esté listo
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Nota pie */}
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
