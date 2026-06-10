'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import SlideOver from '@/components/ui/SlideOver'
import NuevoInformeSlide from './NuevoInformeSlide'
import type { Paciente } from '@/types/database'

const inputCls =
  'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none'
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2'

const DIAS_SEMANA_CERT = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

interface ProfesionalData {
  nombre: string
  apellido: string
  especialidad: string | null
  matricula: string | null
  localidad: string | null
  provincia: string | null
  direccion: string | null
  email: string
  telefono: string | null
  firma_sello_url: string | null
}

interface InformeRow {
  id: string
  tipo_solicitud: string
  diagnostico_cie10_codigo: string | null
  diagnostico_cie10_descripcion: string | null
  periodo_desde: string
  periodo_hasta: string
  observaciones_profesional: string | null
  contenido_generado: string
  estado: string
  created_at: string
  pdf_drive_url: string | null
}

export default function InformesTab({
  paciente,
  profesionalData,
  turnoRecurrente,
}: {
  paciente: Paciente
  profesionalData: ProfesionalData | null
  turnoRecurrente: { dia_semana: number; hora: string } | null
}) {
  const [informes, setInformes] = useState<InformeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [informeEdit, setInformeEdit] = useState<InformeRow | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const dia = turnoRecurrente?.dia_semana !== undefined
    ? DIAS_SEMANA_CERT[turnoRecurrente.dia_semana]
    : '___________'
  const hora = turnoRecurrente?.hora ?? 'HH:MM'

  const textoDefault = `Dejo constancia que Srita. ${paciente.nombre} ${paciente.apellido} DNI Nº ${paciente.dni ?? '___________'}, asiste a sesiones de ${profesionalData?.especialidad ?? '___________'} los días ${dia} en el horario de ${hora} hrs de forma presencial y frecuencia semanal. Ante cualquier duda, quedo a total disposición.`

  const [certOpen, setCertOpen] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [certForm, setCertForm] = useState({
    fechaEmision: today,
    destinatario: 'A quien corresponda',
    cuerpoTexto: textoDefault,
  })

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleEliminar(id: string) {
    setDeleting(true)
    try {
      await fetch(`/api/informes/${id}`, { method: 'DELETE' })
      setConfirmDeleteId(null)
      fetchInformes()
    } finally {
      setDeleting(false)
    }
  }

  async function fetchInformes() {
    const supabase = createClient()
    const { data } = await supabase
      .from('informes_medicos' as never)
      .select('id, tipo_solicitud, diagnostico_cie10_codigo, diagnostico_cie10_descripcion, periodo_desde, periodo_hasta, observaciones_profesional, contenido_generado, estado, created_at, pdf_drive_url')
      .eq('paciente_id', paciente.id)
      .order('created_at', { ascending: false })
    setInformes((data as InformeRow[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchInformes()
  }, [paciente.id])

  function handleOpen() {
    setCertForm({ fechaEmision: today, destinatario: 'A quien corresponda', cuerpoTexto: textoDefault })
    setCertOpen(true)
  }

  async function handleGenerarPDF() {
    if (!certForm.cuerpoTexto.trim()) return
    setCertLoading(true)
    try {
      const res = await fetch('/api/certificados/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: paciente.id,
          fecha_emision: certForm.fechaEmision,
          destinatario: certForm.destinatario,
          cuerpo_texto: certForm.cuerpoTexto,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: unknown }
        showToast(typeof err.error === 'string' ? err.error : 'Error al generar el PDF', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Certificado_${paciente.apellido}_${certForm.fechaEmision}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Certificado generado correctamente')
      setCertOpen(false)
    } catch {
      showToast('Error al generar el PDF', 'error')
    } finally {
      setCertLoading(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.msg}
        </div>
      )}

      {/* Informes Médicos */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Informes Médicos</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              Generá informes clínicos con IA para presentar ante obras sociales y prepagas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setInformeEdit(null); setNuevoOpen(true) }}
            className="btn-primary shrink-0 text-sm py-2 px-3"
          >
            + Nuevo informe
          </button>
        </div>

        {loading ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>Cargando...</p>
        ) : informes.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
            Aún no hay informes médicos para este paciente.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Fecha</th>
                  <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Tipo de solicitud</th>
                  <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--muted)' }}>Diagnóstico</th>
                  <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Estado</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {informes.map((inf) => (
                  <tr key={inf.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-3 px-2 whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                      {inf.created_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-2" style={{ color: 'var(--ink)' }}>
                      <span className="line-clamp-1">{inf.tipo_solicitud}</span>
                    </td>
                    <td className="py-3 px-2 hidden md:table-cell" style={{ color: 'var(--muted)' }}>
                      {inf.diagnostico_cie10_codigo
                        ? `${inf.diagnostico_cie10_codigo} — ${inf.diagnostico_cie10_descripcion ?? ''}`
                        : '—'}
                    </td>
                    <td className="py-3 px-2">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        inf.estado === 'firmado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800',
                      )}>
                        {inf.estado === 'firmado' ? 'Firmado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {confirmDeleteId === inf.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-medium" style={{ color: '#991b1b' }}>¿Eliminar?</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-1 rounded-lg border border-outline-variant/20 hover:bg-surface-container transition-colors"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(inf.id)}
                            disabled={deleting}
                            className="text-xs px-2 py-1 rounded-lg text-white transition-colors disabled:opacity-60"
                            style={{ background: '#dc2626' }}
                          >
                            {deleting ? '...' : 'Sí, eliminar'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {inf.pdf_drive_url && (
                            <a
                              href={inf.pdf_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                              style={{ color: 'var(--accent)' }}
                            >
                              Ver PDF
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => { setInformeEdit(inf); setNuevoOpen(true) }}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {inf.estado === 'firmado' ? 'Ver' : 'Editar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(inf.id)}
                            className="text-xs py-1 px-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Certificado de Asistencia */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Certificado de Asistencia</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Generá un certificado en PDF para presentar donde el paciente lo necesite.
            </p>
          </div>
          <button type="button" onClick={handleOpen} className="btn-secondary shrink-0 text-sm py-2 px-3">
            Generar certificado
          </button>
        </div>
      </div>

      <NuevoInformeSlide
        open={nuevoOpen}
        onClose={() => { setNuevoOpen(false); setInformeEdit(null) }}
        pacienteId={paciente.id}
        pacienteNombre={`${paciente.nombre} ${paciente.apellido}`}
        initialDiagnosticoCodigo={paciente.codigo_diagnostico}
        informeExistente={informeEdit}
        onSuccess={() => { fetchInformes() }}
      />

      <SlideOver
        open={certOpen}
        onClose={() => setCertOpen(false)}
        title="Certificado de Asistencia"
        subtitle={`${paciente.nombre} ${paciente.apellido}`}
        footer={
          <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-gray-200">
            <button type="button" onClick={() => setCertOpen(false)} className="btn-secondary flex-1 py-2.5 text-sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerarPDF}
              disabled={certLoading || !certForm.cuerpoTexto.trim()}
              className={cn('btn-primary flex-1 py-2.5 text-sm', (certLoading || !certForm.cuerpoTexto.trim()) && 'opacity-70')}
            >
              {certLoading ? 'Generando...' : 'Generar PDF'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Fecha de emisión</label>
            <input
              type="date"
              value={certForm.fechaEmision}
              onChange={(e) => setCertForm((prev) => ({ ...prev, fechaEmision: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Destinatario</label>
            <input
              type="text"
              value={certForm.destinatario}
              onChange={(e) => setCertForm((prev) => ({ ...prev, destinatario: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cuerpo del certificado *</label>
            <textarea
              value={certForm.cuerpoTexto}
              onChange={(e) => setCertForm((prev) => ({ ...prev, cuerpoTexto: e.target.value }))}
              rows={8}
              className={cn(inputCls, 'resize-y')}
            />
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
