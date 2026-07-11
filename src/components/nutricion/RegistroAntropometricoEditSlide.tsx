'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SlideOver from '@/components/ui/SlideOver'
import type { RegistroAntropometrico } from '@/types/database'

interface Props {
  registro: RegistroAntropometrico | null
  open: boolean
  onClose: () => void
}

const CAMPOS: { key: keyof CamposEditable; label: string }[] = [
  { key: 'peso', label: 'Peso (kg)' },
  { key: 'altura', label: 'Altura (cm)' },
  { key: 'cintura', label: 'Cintura (cm)' },
  { key: 'cadera', label: 'Cadera (cm)' },
  { key: 'porcentaje_grasa', label: '% Grasa' },
  { key: 'porcentaje_musculo', label: '% Músculo' },
  { key: 'pliegue_tricipital', label: 'Pliegue tricipital (mm)' },
  { key: 'pliegue_subescapular', label: 'Pliegue subescapular (mm)' },
  { key: 'pliegue_suprailiaco', label: 'Pliegue suprailíaco (mm)' },
  { key: 'perimetro_brazo', label: 'Perímetro de brazo (cm)' },
  { key: 'perimetro_pierna', label: 'Perímetro de pierna (cm)' },
]

type CamposEditable = {
  peso: number | null
  altura: number | null
  cintura: number | null
  cadera: number | null
  porcentaje_grasa: number | null
  porcentaje_musculo: number | null
  pliegue_tricipital: number | null
  pliegue_subescapular: number | null
  pliegue_suprailiaco: number | null
  perimetro_brazo: number | null
  perimetro_pierna: number | null
}

function toFormState(r: RegistroAntropometrico | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key } of CAMPOS) {
    const v = r?.[key]
    out[key] = v == null ? '' : String(v)
  }
  return out
}

export default function RegistroAntropometricoEditSlide({ registro, open, onClose }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>(() => toFormState(registro))
  const [fecha, setFecha] = useState(registro?.fecha ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sincronizar cuando cambia el registro seleccionado (nueva fila clickeada)
  if (registro && registro.fecha !== fecha && !loading) {
    setForm(toFormState(registro))
    setFecha(registro.fecha)
  }

  async function handleGuardar() {
    if (!registro) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const num = (v: string) => v.trim() === '' ? null : Number(v)
    const values: Record<string, number | null> = {}
    for (const { key } of CAMPOS) values[key] = num(form[key])

    const { error: dbError } = await supabase
      .from('registros_antropometricos')
      .update({ ...values, fecha } as never)
      .eq('id', registro.id)

    if (dbError) { setError('Error al guardar. Intentá de nuevo.'); setLoading(false); return }
    setLoading(false)
    router.refresh()
    onClose()
  }

  if (!registro) return null

  return (
    <SlideOver open={open} onClose={onClose} title="Editar registro antropométrico">
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-field" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {CAMPOS.map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #5B6472)', opacity: 0.6, fontWeight: 600, marginBottom: 4 }}>
                {label}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form[key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 14,
                  border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)',
                  outline: 'none', background: 'var(--surface, #fff)', color: 'var(--ink, #0B1220)',
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={loading}
            className={`btn-primary flex-1 py-3 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </SlideOver>
  )
}
