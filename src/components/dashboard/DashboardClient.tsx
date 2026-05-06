'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { type Moneda, formatearMonto } from '@/lib/monedas'

const PALETTE = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
]

interface TurnoHoy {
  id: string
  fecha_hora: string
  estado: string
  paciente: { nombre: string; apellido: string } | null
}

interface EntrevistaHoy {
  id: string
  nombre: string
  apellido: string
  hora: string
  estado: string
}

interface PacienteAusente {
  id: string
  nombre: string
  apellido: string
  ultimaCita: string | null
}

interface SerieVence {
  id: string
  fecha_fin: string
  paciente: { nombre: string; apellido: string } | null
}

interface IngresoOrigen {
  nombre: string
  monto: number
}

interface Props {
  nombreTerapeuta: string
  hoyArgStr: string
  turnosHoy: TurnoHoy[]
  entrevistasHoy: EntrevistaHoy[]
  totalPacientesActivos: number
  pacientesAusentes: PacienteAusente[]
  sesionesRealizadasMes: number
  sesionesPendientesMes: number
  ingresosMes: number
  ingresosMesPorMoneda?: Record<string, number>
  ingresosPendientes: number
  ingresosPendientesPorMoneda?: Record<string, number>
  ingresosPorOrigen: IngresoOrigen[]
  seriesVencen: SerieVence[]
  tieneSesionesAnteriorSinLiquidar: boolean
  inicioSemanaStr: string
  finSemanaStr: string
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatARS(n: number): string {
  return '$' + n.toLocaleString('es-AR')
}

function formatFechaCorta(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: es })
}

function estadoTurno(estado: string) {
  if (estado === 'realizado') return { label: 'Realizado', color: 'text-emerald-600', dot: 'bg-emerald-500' }
  if (estado === 'no_asistio') return { label: 'No asistió', color: 'text-red-500', dot: 'bg-red-400' }
  if (estado === 'confirmado') return { label: 'Confirmado', color: 'text-blue-600', dot: 'bg-blue-500' }
  return { label: 'Pendiente', color: 'text-gray-400', dot: 'bg-gray-300' }
}

function horaDesde(fechaHora: string): string {
  return format(parseISO(fechaHora), 'HH:mm')
}

export default function DashboardClient({
  nombreTerapeuta,
  hoyArgStr,
  turnosHoy,
  entrevistasHoy,
  totalPacientesActivos,
  pacientesAusentes,
  sesionesRealizadasMes,
  sesionesPendientesMes,
  ingresosMes,
  ingresosMesPorMoneda,
  ingresosPendientes,
  ingresosPendientesPorMoneda,
  ingresosPorOrigen,
  seriesVencen,
  tieneSesionesAnteriorSinLiquidar,
}: Props) {
  const fechaHoy = format(parseISO(hoyArgStr), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const fechaHoyCapitalizada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)

  const totalSesionesHoy = turnosHoy.length + entrevistasHoy.length
  const realizadasHoy = turnosHoy.filter((t) => t.estado === 'realizado').length

  // Client-only: computed after hydration to avoid server/client time mismatch
  const [greeting, setGreeting] = useState('')
  const [proximoTurnoId, setProximoTurnoId] = useState<string | null>(null)
  useEffect(() => {
    setGreeting(saludo())
    const ahora = new Date()
    const next = turnosHoy.find(
      (t) => (t.estado === 'pendiente' || t.estado === 'confirmado') && new Date(t.fecha_hora) >= ahora,
    )
    setProximoTurnoId(next?.id ?? null)
  }, [turnosHoy])

  // Income chart
  const totalIngresosChart = ingresosPorOrigen.reduce((a, b) => a + b.monto, 0)
  const ingresosOrdenados = [...ingresosPorOrigen].sort((a, b) => b.monto - a.monto)

  const alertCount =
    seriesVencen.length + pacientesAusentes.length + (tieneSesionesAnteriorSinLiquidar ? 1 : 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900" suppressHydrationWarning>
            {greeting ? `${greeting}, ${nombreTerapeuta} 👋` : `Hola, ${nombreTerapeuta} 👋`}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{fechaHoyCapitalizada}</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sesiones hoy</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalSesionesHoy}</p>
            <p className="text-xs text-gray-500 mt-1">
              {realizadasHoy > 0 ? `${realizadasHoy} realizada${realizadasHoy !== 1 ? 's' : ''}` : 'Ninguna realizada aún'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sesiones del mes</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{sesionesRealizadasMes + sesionesPendientesMes}</p>
            <p className="text-xs text-gray-500 mt-1">
              {sesionesRealizadasMes} realizadas · {sesionesPendientesMes} pendientes
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ingresos del mes</p>
            {ingresosMesPorMoneda && Object.keys(ingresosMesPorMoneda).length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {Object.entries(ingresosMesPorMoneda).map(([moneda, total]) => (
                  <p key={moneda} className="text-2xl font-bold text-gray-900 leading-tight">
                    {formatearMonto(total, moneda as Moneda)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatARS(ingresosMes)}</p>
            )}
            {ingresosPendientesPorMoneda && Object.keys(ingresosPendientesPorMoneda).length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {Object.entries(ingresosPendientesPorMoneda).map(([moneda, total]) => (
                  <p key={moneda} className="text-xs text-amber-600">
                    {formatearMonto(total, moneda as Moneda)} pendientes
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Todo cobrado</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pacientes activos</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalPacientesActivos}</p>
            {pacientesAusentes.length > 0 ? (
              <p className="text-xs text-amber-600 mt-1">
                {pacientesAusentes.length} sin venir hace 2+ sem.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Todos asistiendo</p>
            )}
          </div>
        </div>

        {/* Center row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Turnos de hoy */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Turnos de hoy</h2>
              <Link href="/agenda" className="text-xs text-primary-600 hover:underline font-medium">
                Ver agenda →
              </Link>
            </div>

            <div className="divide-y divide-gray-50 flex-1">
              {turnosHoy.length === 0 && entrevistasHoy.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">No tenés más turnos por hoy</p>
              )}

              {turnosHoy.map((t) => {
                const isProximo = t.id === proximoTurnoId
                const st = estadoTurno(t.estado)
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-5 py-3 ${isProximo ? 'border-l-2 border-primary-500 bg-primary-50/40' : ''}`}
                  >
                    <span className="text-sm font-mono text-gray-500 w-12 shrink-0">{horaDesde(t.fecha_hora)}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                      {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '—'}
                    </span>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                )
              })}

              {entrevistasHoy.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-sm font-mono text-gray-500 w-12 shrink-0">{e.hora.slice(0, 5)}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {e.apellido}, {e.nombre}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Entrevista
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Alertas</h2>
              {alertCount > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              {alertCount === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Todo en orden ✅</p>
              )}

              {seriesVencen.length > 0 && (
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <p className="text-sm font-medium text-gray-700">
                      {seriesVencen.length} serie{seriesVencen.length !== 1 ? 's' : ''} recurrente{seriesVencen.length !== 1 ? 's' : ''} vence{seriesVencen.length === 1 ? '' : 'n'} en menos de 30 días
                    </p>
                  </div>
                  <ul className="ml-6 space-y-1">
                    {seriesVencen.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-xs text-gray-500">
                        · {s.paciente ? `${s.paciente.nombre} ${s.paciente.apellido}` : '—'} — vence {formatFechaCorta(s.fecha_fin)}
                      </li>
                    ))}
                    {seriesVencen.length > 3 && (
                      <li className="text-xs text-gray-400">+ {seriesVencen.length - 3} más</li>
                    )}
                  </ul>
                </div>
              )}

              {pacientesAusentes.length > 0 && (
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <p className="text-sm font-medium text-gray-700">
                      {pacientesAusentes.length} paciente{pacientesAusentes.length !== 1 ? 's' : ''} sin venir hace más de 2 semanas
                    </p>
                  </div>
                  <ul className="ml-6 space-y-1">
                    {pacientesAusentes.slice(0, 3).map((p) => (
                      <Link key={p.id} href={`/pacientes/${p.id}`} className="block">
                        <li className="text-xs text-gray-500 hover:text-primary-600">
                          · {p.nombre} {p.apellido}
                          {p.ultimaCita ? ` — última sesión ${formatFechaCorta(p.ultimaCita)}` : ''}
                        </li>
                      </Link>
                    ))}
                    {pacientesAusentes.length > 3 && (
                      <li className="text-xs text-gray-400">+ {pacientesAusentes.length - 3} más</li>
                    )}
                  </ul>
                </div>
              )}

              {tieneSesionesAnteriorSinLiquidar && (
                <div>
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-base leading-none mt-0.5">📋</span>
                    <p className="text-sm font-medium text-gray-700">
                      Tenés sesiones del mes anterior sin liquidar
                    </p>
                  </div>
                  <Link href="/facturacion/liquidacion" className="ml-6 text-xs text-primary-600 hover:underline">
                    Ir a liquidación →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Income chart */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Ingresos del mes por origen
          </h2>

          {ingresosOrdenados.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Todavía no hay ingresos registrados este mes</p>
          )}

          {ingresosOrdenados.length > 0 && (
            <div className="space-y-3">
              {ingresosOrdenados.map((item, idx) => {
                const pct = totalIngresosChart > 0 ? Math.round((item.monto / totalIngresosChart) * 100) : 0
                const color = PALETTE[idx % PALETTE.length]
                return (
                  <div key={item.nombre} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm text-gray-700 truncate">{item.nombre}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-medium text-gray-700">
                      {formatARS(item.monto)}
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs text-gray-400">{pct}%</span>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-800">
                <span>Total</span>
                <span>{formatARS(totalIngresosChart)}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
