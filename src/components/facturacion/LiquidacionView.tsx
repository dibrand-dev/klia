'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfesionalObraSocial, Paciente } from '@/types/database'
import type { ItemLiquidacion } from '@/lib/liquidacion-excel'
import SlideOver from '@/components/ui/SlideOver'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type ResumenOS = {
  os: ProfesionalObraSocial
  pacientes: number
  sesiones: number
  importe: number
  items: ItemLiquidacion[]
  cargado: boolean
}

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  generada: 'bg-blue-50 text-blue-700',
  presentada: 'bg-amber-50 text-amber-700',
  cobrada: 'bg-green-50 text-green-700',
}

function formatARS(n: number) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function LiquidacionView({ osList, terapeutaId }: {
  osList: ProfesionalObraSocial[]
  terapeutaId: string
}) {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [resumenes, setResumenes] = useState<ResumenOS[]>(
    osList.map(os => ({ os, pacientes: 0, sesiones: 0, importe: 0, items: [], cargado: false }))
  )
  const [cargando, setCargando] = useState(false)
  const [detalle, setDetalle] = useState<ResumenOS | null>(null)
  const [generando, setGenerando] = useState<string | null>(null)
  const [turnosNoARS, setTurnosNoARS] = useState(0)

  const calcular = useCallback(async () => {
    setCargando(true)
    const supabase = createClient()

    const inicio = new Date(anio, mes - 1, 1).toISOString()
    const fin = new Date(anio, mes, 0, 23, 59, 59).toISOString()

    const nuevos = await Promise.all(
      osList.map(async (os) => {
        const { data: pacientes } = await supabase
          .from('pacientes')
          .select('id, nombre, apellido, numero_afiliado, numero_autorizacion')
          .eq('os_config_id', os.id)
          .eq('terapeuta_id', terapeutaId)

        const pacs = pacientes ?? []
        if (pacs.length === 0) {
          return { os, pacientes: 0, sesiones: 0, importe: 0, items: [], cargado: true }
        }

        const pacienteIds = pacs.map(p => p.id)
        // Las obras sociales SIEMPRE cuentan 'no_asistio' como cobrable,
        // independientemente de la política de inasistencias del profesional.
        // La política configurable aplica sólo a la facturación directa con el paciente.
        const { data: turnos } = await supabase
          .from('turnos')
          .select('paciente_id, moneda')
          .in('paciente_id', pacienteIds)
          .in('estado', ['realizado', 'no_asistio'])
          .gte('fecha_hora', inicio)
          .lte('fecha_hora', fin)

        const sesionesMap: Record<string, number> = {}
        for (const t of turnos ?? []) {
          sesionesMap[t.paciente_id] = (sesionesMap[t.paciente_id] ?? 0) + 1
        }

        const items: ItemLiquidacion[] = pacs
          .filter(p => (sesionesMap[p.id] ?? 0) > 0)
          .map(p => {
            const cantidad = sesionesMap[p.id] ?? 0
            const honorario = os.honorario_por_sesion ?? 0
            return {
              paciente: p as Pick<Paciente, 'nombre' | 'apellido' | 'numero_afiliado' | 'numero_autorizacion'>,
              cantidad_sesiones: cantidad,
              honorario_unitario: honorario,
              importe_total: parseFloat((cantidad * honorario).toFixed(2)),
            }
          })

        const totalSesiones = items.reduce((s, i) => s + i.cantidad_sesiones, 0)
        const totalImporte = items.reduce((s, i) => s + i.importe_total, 0)

        return { os, pacientes: pacs.length, sesiones: totalSesiones, importe: totalImporte, items, cargado: true }
      })
    )

    setResumenes(nuevos)

    // Check for non-ARS turnos in this period for this therapist
    const { count: noARSCount } = await supabase
      .from('turnos')
      .select('id', { count: 'exact', head: true })
      .eq('terapeuta_id', terapeutaId)
      .in('estado', ['realizado', 'no_asistio'])
      .gte('fecha_hora', inicio)
      .lte('fecha_hora', fin)
      .neq('moneda', 'ARS')

    setTurnosNoARS(noARSCount ?? 0)
    setCargando(false)
  }, [mes, anio, osList, terapeutaId])

  async function handleGenerarExcel(res: ResumenOS) {
    setGenerando(res.os.id)
    const { generarExcelOS } = await import('@/lib/liquidacion-excel')
    generarExcelOS(res.items, res.os, mes, anio)

    const supabase = createClient()
    await supabase.from('liquidaciones').upsert({
      terapeuta_id: terapeutaId,
      os_config_id: res.os.id,
      periodo_mes: mes,
      periodo_anio: anio,
      estado: 'generada',
      total_sesiones: res.sesiones,
      total_importe: res.importe,
    }, { onConflict: 'terapeuta_id,os_config_id,periodo_mes,periodo_anio' })

    setGenerando(null)
  }

  const anios = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <>
      <SlideOver
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title={`Detalle — ${detalle?.os.nombre}`}
        subtitle={`${MESES[mes - 1]} ${anio}`}
        width="lg"
      >
        {detalle && (
          <div>
            {detalle.items.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-8 text-center">Sin sesiones realizadas en este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/10 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      <th className="text-left py-3 pr-4">Paciente</th>
                      <th className="text-left py-3 pr-4">Afiliado</th>
                      <th className="text-left py-3 pr-4">Autorización</th>
                      <th className="text-right py-3 pr-4">Sesiones</th>
                      <th className="text-right py-3">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.items.map((item, i) => (
                      <tr key={i} className="border-b border-outline-variant/5">
                        <td className="py-3 pr-4 font-medium text-on-surface">
                          {item.paciente.apellido.toUpperCase()}, {item.paciente.nombre}
                        </td>
                        <td className="py-3 pr-4 text-on-surface-variant">{item.paciente.numero_afiliado || '—'}</td>
                        <td className="py-3 pr-4 text-on-surface-variant">{item.paciente.numero_autorizacion || '—'}</td>
                        <td className="py-3 pr-4 text-right">{item.cantidad_sesiones}</td>
                        <td className="py-3 text-right font-medium">{formatARS(item.importe_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-outline-variant/20 font-bold">
                      <td colSpan={3} className="py-3 text-on-surface">Total</td>
                      <td className="py-3 text-right">{detalle.sesiones}</td>
                      <td className="py-3 text-right">{formatARS(detalle.importe)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {detalle.items.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => handleGenerarExcel(detalle)}
                  disabled={generando === detalle.os.id}
                  className="btn-primary w-full py-2.5 disabled:opacity-70"
                >
                  {generando === detalle.os.id ? 'Generando...' : 'Descargar Excel'}
                </button>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* Selector de período */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">Mes</label>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="bg-white border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">Año</label>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="bg-white border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button
          onClick={calcular}
          disabled={cargando}
          className="btn-primary px-6 py-2.5 disabled:opacity-70"
        >
          {cargando ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {/* Aviso turno no-ARS */}
      {turnosNoARS > 0 && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
          <p className="text-sm text-amber-800">
            Hay {turnosNoARS} turno{turnosNoARS !== 1 ? 's' : ''} en moneda extranjera (USD o EUR) en este período.
            La liquidación de obras sociales sólo contempla importes en pesos (ARS).
          </p>
        </div>
      )}

      {/* Lista de OS */}
      {osList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-14 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">health_and_safety</span>
          <p className="text-sm">No tenés obras sociales configuradas.</p>
          <a href="/ajustes/obras-sociales" className="text-sm text-primary hover:underline mt-2 block">
            Configurar obras sociales →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {resumenes.map((res) => (
            <div key={res.os.id} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-on-surface">{res.os.nombre}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ESTADO_BADGE['borrador']}`}>
                      Borrador
                    </span>
                  </div>
                  {res.cargado ? (
                    res.sesiones > 0 ? (
                      <p className="text-sm text-on-surface-variant">
                        {res.pacientes} paciente{res.pacientes !== 1 ? 's' : ''} · {res.sesiones} sesiones · {formatARS(res.importe)}
                      </p>
                    ) : (
                      <p className="text-sm text-on-surface-variant">Sin turnos cobrables en este período</p>
                    )
                  ) : (
                    <p className="text-sm text-on-surface-variant opacity-60">Presioná Calcular para ver los datos</p>
                  )}
                </div>
                {res.cargado && res.sesiones > 0 && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setDetalle(res)}
                      className="text-sm px-4 py-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low transition-colors"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => handleGenerarExcel(res)}
                      disabled={generando === res.os.id}
                      className="text-sm px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      {generando === res.os.id ? 'Generando...' : 'Excel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
