'use client'

import { useState, useMemo } from 'react'
import ResumenIA from './ResumenIA'
import { estadoAutorizacion } from '@/lib/pacientes/estadoAutorizacion'

type Paciente = {
  id: string
  nombre: string
  apellido: string
  fecha_nacimiento: string | null
  obra_social: string | null
  os_config_id: string | null
  codigo_diagnostico: string | null
  modalidad_tratamiento: string | null
  autorizacion_vigencia_hasta: string | null
}

type Turno = {
  id: string
  fecha_hora: string
  duracion_min: number
  modalidad: string
  estado: string
  ai_summary: string | null
  estado_atencion: string | null
  paciente: Paciente | null
}

type Props = {
  turnos: Turno[]
  hoyArgStr: string
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  realizado: 'Atendido',
  no_asistio: 'Ausente',
  cancelado: 'Cancelado',
}

const ESTADO_STYLE: Record<string, string> = {
  pendiente:  'bg-blue-50 text-blue-700 border-blue-100',
  confirmado: 'bg-green-50 text-green-700 border-green-100',
  realizado:  'bg-gray-100 text-gray-500 border-gray-200',
  no_asistio: 'bg-red-50 text-red-600 border-red-100',
  cancelado:  'bg-gray-100 text-gray-400 border-gray-200 line-through',
}

const ESTADO_ATENCION_LABEL: Record<string, string> = {
  en_preparacion: 'En Preparación',
  en_espera: 'En Espera',
  en_consultorio: 'En Consultorio',
  atendido: 'Atendido',
  ausente: 'Ausente',
}

const ESTADO_ATENCION_STYLE: Record<string, string> = {
  en_preparacion: 'bg-purple-50 text-purple-700 border-purple-100',
  en_espera:      'bg-blue-50 text-blue-700 border-blue-100',
  en_consultorio: 'bg-amber-50 text-amber-700 border-amber-100',
  atendido:       'bg-gray-100 text-gray-500 border-gray-200',
  ausente:        'bg-red-50 text-red-600 border-red-100',
}

function calcEdad(fechaNac: string | null): string {
  if (!fechaNac) return '—'
  const años = Math.floor((Date.now() - new Date(fechaNac).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return `${años} a.`
}

function initials(nombre: string, apellido: string) {
  return `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase()
}

function horaArg(fechaHora: string) {
  return new Date(fechaHora).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
}

const AV_COLORS = [
  { bg: 'linear-gradient(145deg,#E3E9F6,#C9D3E9)', color: '#16389F' },
  { bg: 'linear-gradient(145deg,#F4E4E0,#E5C9C0)', color: '#8A3520' },
  { bg: 'linear-gradient(145deg,#E4F0E4,#C0DBC0)', color: '#205A2E' },
  { bg: 'linear-gradient(145deg,#F2E8F4,#DCC0E0)', color: '#5B3DC9' },
  { bg: 'linear-gradient(145deg,#F4EEDC,#E0D2A6)', color: '#7A5A0F' },
]
function avColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AV_COLORS[h % AV_COLORS.length]
}

export default function AtencionesClient({ turnos: turnosIniciales, hoyArgStr }: Props) {
  const [turnos, setTurnos] = useState(turnosIniciales)
  const [filtro, setFiltro] = useState<'all' | 'pendientes' | 'atendidos'>('all')
  const [busqueda, setBusqueda] = useState('')
  const [slideOver, setSlideOver] = useState<Turno | null>(null)

  const fechaFormato = new Date(hoyArgStr + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function actualizarEstadoAtencion(turnoId: string, estadoAtencion: string) {
    const res = await fetch('/api/turnos/estado-atencion', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turnoId, estado_atencion: estadoAtencion }),
    })
    if (!res.ok) return
    setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, estado_atencion: estadoAtencion } : t))
    setSlideOver(prev => prev && prev.id === turnoId ? { ...prev, estado_atencion: estadoAtencion } : prev)
  }

  const stats = useMemo(() => ({
    total: turnos.length,
    confirmados: turnos.filter(t => t.estado === 'confirmado').length,
    enEspera: turnos.filter(t => t.estado_atencion === 'en_espera').length,
    atendidos: turnos.filter(t => t.estado === 'realizado' || t.estado_atencion === 'atendido').length,
    ausentes: turnos.filter(t => t.estado === 'no_asistio' || t.estado_atencion === 'ausente').length,
    enConsultorio: turnos.filter(t => t.estado_atencion === 'en_consultorio').length,
  }), [turnos])

  const filtrados = useMemo(() => {
    let lista = turnos
    if (filtro === 'pendientes') {
      lista = lista.filter(t =>
        ['pendiente', 'confirmado'].includes(t.estado) &&
        !['atendido', 'ausente'].includes(t.estado_atencion ?? '')
      )
    }
    if (filtro === 'atendidos') {
      lista = lista.filter(t =>
        ['realizado', 'no_asistio'].includes(t.estado) ||
        ['atendido', 'ausente'].includes(t.estado_atencion ?? '')
      )
    }
    if (busqueda) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(t => {
        const p = t.paciente
        return p && (`${p.nombre} ${p.apellido}`).toLowerCase().includes(q)
      })
    }
    return lista
  }, [turnos, filtro, busqueda])

  const STAT_ITEMS = [
    { label: 'Total', value: stats.total, dotClass: 'bg-blue-400' },
    { label: 'Confirmados', value: stats.confirmados, dotClass: 'bg-green-400' },
    { label: 'En espera', value: stats.enEspera, dotClass: 'bg-amber-400' },
    { label: 'En consultorio', value: stats.enConsultorio, dotClass: 'bg-amber-400' },
    { label: 'Atendidos', value: stats.atendidos, dotClass: 'bg-gray-400' },
    { label: 'Ausentes', value: stats.ausentes, dotClass: 'bg-red-400' },
  ]

  return (
    <div className="px-6 md:px-8 pt-6 pb-20 max-w-[1320px] w-full mx-auto">

      {/* Header */}
      <div className="flex items-end gap-4 flex-wrap pb-1 mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight leading-tight">Atenciones del Día</h1>
          <p className="text-sm text-on-surface-variant mt-1">Seguimiento de turnos y resúmenes clínicos con IA</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-on-surface-variant border border-outline-variant/20 bg-surface-container-high/40 rounded-full px-3 py-1.5">
          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
          <span className="font-medium text-on-surface capitalize">{fechaFormato}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 border border-outline-variant/20 rounded-xl bg-surface overflow-hidden my-5">
        {STAT_ITEMS.map((s, i) => (
          <div key={s.label} className={`px-4 py-3.5 ${i < STAT_ITEMS.length - 1 ? 'border-r border-b md:border-b-0 border-outline-variant/20' : ''}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />
              {s.label}
            </div>
            <div className="text-2xl font-semibold text-on-surface tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 py-3">
        <div className="flex bg-surface border border-outline-variant/20 rounded-lg p-0.5 gap-0.5">
          {([['all', 'Todos', stats.total], ['pendientes', 'Pendientes', stats.enEspera + stats.confirmados + stats.enConsultorio], ['atendidos', 'Atendidos', stats.atendidos + stats.ausentes]] as const).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFiltro(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filtro === val ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {label}
              <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${filtro === val ? 'bg-on-surface text-surface' : 'bg-surface-container text-on-surface-variant'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto hidden md:flex items-center gap-2 bg-surface border border-outline-variant/20 rounded-lg px-3 h-8 w-56">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">search</span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Filtrar por paciente…"
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-outline-variant/20 rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container/40">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-20">Hora</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3">Paciente</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-20 hidden md:table-cell">Edad</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-48 hidden md:table-cell">Obra social</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-28 hidden lg:table-cell">Modalidad</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-32">Estado</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-4 py-3 w-px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-on-surface-variant">
                  No hay turnos para mostrar.
                </td>
              </tr>
            )}
            {filtrados.map((turno) => {
              const p = turno.paciente
              const hora = horaArg(turno.fecha_hora)
              const av = p ? avColor(p.id) : AV_COLORS[0]
              const ini = p ? initials(p.nombre, p.apellido) : '?'
              const nombre = p ? `${p.nombre} ${p.apellido}` : 'Paciente'
              const edad = calcEdad(p?.fecha_nacimiento ?? null)
              const os = p?.obra_social || 'Particular'
              const hasCache = !!turno.ai_summary
              const autorizacion = estadoAutorizacion(p?.autorizacion_vigencia_hasta ?? null)

              return (
                <tr
                  key={turno.id}
                  className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/30 transition-colors cursor-pointer"
                  onClick={() => setSlideOver(turno)}
                >
                  {/* Hora */}
                  <td className="px-4 py-3.5 font-mono text-[13px] text-on-surface-variant font-medium tabular-nums whitespace-nowrap">
                    {hora}
                  </td>

                  {/* Paciente */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-[10px] flex-none grid place-items-center font-semibold text-[13px]"
                        style={{ background: av.bg, color: av.color }}
                      >
                        {ini}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface text-[13.5px] truncate flex items-center gap-1.5">
                          {nombre}
                          {autorizacion && (
                            <span
                              className={`material-symbols-outlined text-[15px] flex-shrink-0 ${
                                autorizacion.tono === 'vencida' ? 'text-red-600' : 'text-amber-600'
                              }`}
                              title={`Autorización de obra social: ${autorizacion.label.toLowerCase()}`}
                            >
                              warning
                            </span>
                          )}
                        </p>
                        <p className="text-[11.5px] text-on-surface-variant mt-0.5">
                          {p?.modalidad_tratamiento || p?.codigo_diagnostico || 'Sin datos adicionales'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Edad */}
                  <td className="px-4 py-3.5 text-sm text-on-surface-variant hidden md:table-cell tabular-nums">
                    {edad}
                  </td>

                  {/* OS */}
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-[13px] font-medium text-on-surface-variant">{os}</p>
                  </td>

                  {/* Modalidad */}
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[13px]">
                        {turno.modalidad === 'videollamada' ? 'videocam' : 'home'}
                      </span>
                      {turno.modalidad === 'videollamada' ? 'Virtual' : 'Presencial'}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border ${(turno.estado_atencion ? ESTADO_ATENCION_STYLE[turno.estado_atencion] : ESTADO_STYLE[turno.estado]) ?? 'bg-gray-100 text-gray-500'}`}>
                      {turno.estado_atencion === 'en_consultorio' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      )}
                      {turno.estado_atencion ? (ESTADO_ATENCION_LABEL[turno.estado_atencion] ?? turno.estado_atencion) : (ESTADO_LABEL[turno.estado] ?? turno.estado)}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 justify-end">
                      {(!turno.estado_atencion || turno.estado_atencion === 'en_preparacion') && (
                        <button
                          onClick={() => actualizarEstadoAtencion(turno.id, 'en_espera')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container"
                          title="Marcar en espera"
                        >
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          En espera
                        </button>
                      )}
                      {turno.estado_atencion === 'en_espera' && (
                        <button
                          onClick={() => actualizarEstadoAtencion(turno.id, 'en_consultorio')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container"
                          title="Pasar a consultorio"
                        >
                          <span className="material-symbols-outlined text-[13px]">meeting_room</span>
                          A consultorio
                        </button>
                      )}
                      {turno.estado_atencion === 'en_consultorio' && (
                        <button
                          onClick={() => actualizarEstadoAtencion(turno.id, 'atendido')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container"
                          title="Marcar atendido"
                        >
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          Atendido
                        </button>
                      )}
                      <button
                        onClick={() => setSlideOver(turno)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white relative"
                        style={{ background: 'linear-gradient(135deg,#5B3DC9 0%,#1F4FD9 100%)' }}
                        title="Resumen IA"
                      >
                        <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                        IA
                        {hasCache && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400 border-2 border-white" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant/60">
        <span className="material-symbols-outlined text-[13px]">info</span>
        Los resúmenes generados se guardan en la ficha del paciente y se reutilizan para optimizar costos.
      </p>

      {/* SlideOver */}
      {slideOver && (
        <ResumenIA
          turnoId={slideOver.id}
          pacienteId={slideOver.paciente?.id ?? ''}
          pacienteNombre={slideOver.paciente ? `${slideOver.paciente.nombre} ${slideOver.paciente.apellido}` : 'Paciente'}
          pacienteAge={calcEdad(slideOver.paciente?.fecha_nacimiento ?? null)}
          pacienteOS={slideOver.paciente?.obra_social ?? ''}
          turnoHora={horaArg(slideOver.fecha_hora)}
          modalidad={slideOver.modalidad}
          initialSummary={slideOver.ai_summary}
          onClose={() => setSlideOver(null)}
        />
      )}
    </div>
  )
}
