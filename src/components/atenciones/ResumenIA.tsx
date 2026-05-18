'use client'

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

type Props = {
  turnoId: string
  pacienteId: string
  pacienteNombre: string
  pacienteAge: string
  pacienteOS: string
  turnoHora: string
  modalidad: string
  initialSummary: string | null
  onClose: () => void
}

const SECTION_STYLES = [
  { icon: 'show_chart',   iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',   cardBg: 'bg-white',       border: 'border-gray-100'   },
  { icon: 'edit',         iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',  cardBg: 'bg-white',       border: 'border-amber-100'  },
  { icon: 'my_location',  iconBg: 'bg-purple-100', iconColor: 'text-purple-600', cardBg: 'bg-purple-50/50', border: 'border-purple-100' },
]

function parseSections(md: string) {
  return md.split(/(?=^###\s)/m).filter(p => p.trim()).map(part => {
    const lines = part.split('\n')
    const header = lines[0].replace(/^###\s+/, '').trim()
    const content = lines.slice(1).join('\n').trim()
    return { header, content }
  })
}

const MD_COMPONENTS = {
  ul: ({ children }: { children: ReactNode }) => (
    <ul className="space-y-1 mb-3 mt-1">{children}</ul>
  ),
  li: ({ children }: { children: ReactNode }) => (
    <li className="flex items-start gap-2 text-sm text-gray-700 py-1">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }: { children: ReactNode }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  p: ({ children }: { children: ReactNode }) => (
    <p className="text-sm text-gray-700 mb-1 leading-relaxed">{children}</p>
  ),
  h3: () => null,
}

export default function ResumenIA({
  turnoId,
  pacienteId,
  pacienteNombre,
  pacienteAge,
  pacienteOS,
  turnoHora,
  modalidad,
  initialSummary,
  onClose,
}: Props) {
  const [summary, setSummary] = useState<string | null>(initialSummary)
  const [loading, setLoading] = useState(false)
  const [cached, setCached] = useState(!!initialSummary)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialSummary) {
      setSummary(initialSummary)
      setCached(true)
    }
  }, [initialSummary])

  const initials = pacienteNombre
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function generarResumen() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/atenciones/resumen-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turnoId, paciente_id: pacienteId }),
      })
      if (!res.ok) throw new Error('Error al generar resumen')
      const data = await res.json() as { summary: string; cached: boolean }
      setSummary(data.summary)
      setCached(data.cached)
    } catch {
      setError('No se pudo generar el resumen. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const sections = summary ? parseSections(summary) : []

  return (
    <>
      {/* Scrim */}
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} />

      {/* SlideOver */}
      <aside className="fixed top-0 right-0 bottom-0 w-[520px] max-w-full bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-start gap-3"
          style={{ background: 'linear-gradient(180deg,#f0f4ff 0%,transparent 100%)' }}
        >
          <div
            className="w-11 h-11 rounded-xl flex-none grid place-items-center font-semibold text-base"
            style={{ background: 'linear-gradient(145deg,#E3E9F6,#C9D3E9)', color: '#16389F' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-[15px] leading-tight">{pacienteNombre}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1.5 items-center">
              <span>{pacienteAge}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{pacienteOS || 'Particular'}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{turnoHora} · {modalidad === 'videollamada' ? 'Virtual' : 'Presencial'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center hover:bg-gray-100 transition-colors flex-none"
          >
            <span className="material-symbols-outlined text-[18px] text-gray-500">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* State 1 — not generated */}
          {!summary && !loading && (
            <>
              <div
                className="rounded-xl p-6 text-center relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#F4F0FE 0%,#EAF0FE 100%)', border: '1px solid #d4c9f5' }}
              >
                <div
                  className="w-11 h-11 rounded-xl mx-auto mb-3 grid place-items-center"
                  style={{ background: 'linear-gradient(135deg,#5B3DC9 0%,#1F4FD9 100%)', boxShadow: '0 8px 18px rgba(91,61,201,.32)' }}
                >
                  <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
                </div>
                <h3 className="font-semibold text-gray-900 text-[15px] mb-1.5">¿Querés preparar la sesión?</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Generá un resumen con IA basado en el historial clínico, medicamentos actuales e interconsultas de este paciente.
                </p>
                {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
                <button
                  onClick={generarResumen}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg,#5B3DC9 0%,#1F4FD9 100%)', boxShadow: '0 4px 12px rgba(31,79,217,.32)' }}
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Generar Resumen Inteligente
                </button>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex gap-2.5 text-xs text-gray-500">
                <span className="material-symbols-outlined text-[14px] flex-none mt-0.5">info</span>
                <span>El resumen se genera <strong>una sola vez por sesión</strong> y se guarda en la ficha. Usa el motor <strong>Gemini Fast</strong> para optimizar tiempo y costo.</span>
              </div>
            </>
          )}

          {/* State 2 — loading */}
          {loading && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-700">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-none" />
                Analizando historial clínico, medicación y notas previas…
              </div>
              {SECTION_STYLES.map((s, i) => (
                <div key={i} className={`rounded-xl border p-4 ${s.cardBg} ${s.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg animate-pulse ${s.iconBg}`} />
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-36" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-[90%]" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-[72%]" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-[81%]" />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* State 3 — generated */}
          {summary && !loading && (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 font-medium">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {cached ? 'Resumen guardado · Costo $0' : 'Resumen generado · Gemini Fast'}
              </div>

              {/* Section cards */}
              {sections.map((section, i) => {
                const s = SECTION_STYLES[i] ?? SECTION_STYLES[0]
                return (
                  <div key={i} className={`rounded-xl border p-4 ${s.cardBg} ${s.border}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 rounded-lg grid place-items-center flex-none ${s.iconBg}`}>
                        <span className={`material-symbols-outlined text-[15px] ${s.iconColor}`}>{s.icon}</span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {section.header.replace(/^[📌💊🎯]\s*/, '')}
                      </span>
                    </div>
                    <ReactMarkdown components={MD_COMPONENTS as object}>
                      {section.content}
                    </ReactMarkdown>
                  </div>
                )
              })}

              <p className="flex items-start gap-2 text-[11px] text-gray-400 pt-1">
                <span className="material-symbols-outlined text-[13px] mt-0.5">info</span>
                El resumen es una herramienta de apoyo. La decisión clínica corresponde al profesional.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 flex gap-3 bg-white">
          <Link
            href={`/pacientes/${pacienteId}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            Ver Ficha Completa
          </Link>
          <Link
            href={`/pacientes/${pacienteId}/historial/nueva?turno_id=${turnoId}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: 'linear-gradient(135deg,#001a48 0%,#1F4FD9 100%)' }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Iniciar Evolución de Hoy
          </Link>
        </div>
      </aside>
    </>
  )
}
