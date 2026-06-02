'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ObraSocial } from '@/types/database'

// Known planilla templates by OS name pattern
const PLANILLA_TEMPLATES = [
  { id: 'hospital_italiano', label: 'Hospital Italiano' },
] as const

function detectTemplate(nombre: string): string | null {
  if (nombre.toLowerCase().includes('hospital italiano')) return 'hospital_italiano'
  return null
}

const STORAGE_BUCKET = 'obras-sociales'

interface Props {
  obras: ObraSocial[]
}

interface OSLogoState {
  uploading: boolean
  error: string | null
  logoUrl: string | null
}

export default function PlanillaConfigPanel({ obras }: Props) {
  const [logoStates, setLogoStates] = useState<Record<string, OSLogoState>>(() => {
    const init: Record<string, OSLogoState> = {}
    obras.forEach((o) => { init[o.id] = { uploading: false, error: null, logoUrl: null } })
    return init
  })
  const [loadedLogos, setLoadedLogos] = useState<Record<string, string | null>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function loadLogo(osId: string) {
    if (loadedLogos[osId] !== undefined) return
    const supabase = createClient()
    const { data: list } = await supabase.storage.from(STORAGE_BUCKET).list('logos', { search: osId })
    const logoFile = (list ?? []).find((f) => f.name.startsWith(osId))
    if (!logoFile) {
      setLoadedLogos((prev) => ({ ...prev, [osId]: null }))
      return
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`logos/${logoFile.name}`)
    setLoadedLogos((prev) => ({ ...prev, [osId]: data.publicUrl }))
  }

  async function uploadLogo(osId: string, file: File) {
    setLogoStates((prev) => ({ ...prev, [osId]: { ...prev[osId], uploading: true, error: null } }))
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `logos/${osId}.${ext}`
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
    })
    if (error) {
      setLogoStates((prev) => ({ ...prev, [osId]: { ...prev[osId], uploading: false, error: error.message } }))
      return
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    setLogoStates((prev) => ({ ...prev, [osId]: { uploading: false, error: null, logoUrl: data.publicUrl } }))
    setLoadedLogos((prev) => ({ ...prev, [osId]: data.publicUrl + '?t=' + Date.now() }))
  }

  const obrasSorted = obras
    .slice()
    .sort((a, b) => {
      const aHas = detectTemplate(a.nombre) !== null ? 0 : 1
      const bHas = detectTemplate(b.nombre) !== null ? 0 : 1
      return aHas - bHas || a.nombre.localeCompare(b.nombre)
    })

  return (
    <div className="space-y-3">
      {obrasSorted.map((obra) => {
        const template = detectTemplate(obra.nombre)
        const state = logoStates[obra.id] ?? { uploading: false, error: null, logoUrl: null }
        const currentLogoUrl = state.logoUrl ?? loadedLogos[obra.id]

        return (
          <div
            key={obra.id}
            className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 flex items-center gap-4"
            onMouseEnter={() => loadLogo(obra.id)}
          >
            {/* Logo */}
            <div className="w-16 h-16 bg-surface-container rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-outline-variant/15">
              {currentLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentLogoUrl} alt={obra.nombre} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">health_and_safety</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{obra.nombre}</p>
              <div className="flex items-center gap-2 mt-1">
                {template ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    {PLANILLA_TEMPLATES.find((t) => t.id === template)?.label ?? template}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant/60 bg-surface-container px-2 py-0.5 rounded-full">
                    Sin planilla configurada
                  </span>
                )}
              </div>
              {state.error && (
                <p className="text-xs text-red-600 mt-1">{state.error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                ref={(el) => { fileInputRefs.current[obra.id] = el }}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadLogo(obra.id, file)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRefs.current[obra.id]?.click()}
                disabled={state.uploading}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
              >
                {state.uploading ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">upload</span>
                )}
                {currentLogoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
            </div>
          </div>
        )
      })}

      {obrasSorted.length === 0 && (
        <p className="text-sm text-on-surface-variant text-center py-8">
          No hay obras sociales validadas todavía.
        </p>
      )}

      <p className="text-xs text-on-surface-variant/60 pt-2">
        El logo se usa en la cabecera del PDF de la planilla de asistencia. Formatos aceptados: PNG, JPG, SVG, WebP.
        Para agregar soporte de planilla a una nueva obra social, contactar al equipo técnico.
      </p>
    </div>
  )
}
