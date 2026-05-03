'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const HORAS_INICIO = Array.from({ length: 24 }, (_, i) => i)
const HORAS_FIN = Array.from({ length: 23 }, (_, i) => i + 1)

export default function HorarioAgendaConfig({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [horaInicio, setHoraInicio] = useState(profile.agenda_hora_inicio ?? 7)
  const [horaFin, setHoraFin] = useState(profile.agenda_hora_fin ?? 21)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleGuardar() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ agenda_hora_inicio: horaInicio, agenda_hora_fin: horaFin })
      .eq('id', profile.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-primary">schedule</span>
        Horario de atención
      </h2>
      <p className="text-xs text-on-surface-variant mb-5">
        Define el rango de horas visible en la agenda.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Hora de inicio
          </label>
          <select
            value={horaInicio}
            onChange={(e) => { setHoraInicio(Number(e.target.value)); setSaved(false) }}
            className="bg-white border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            {HORAS_INICIO.map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Hora de fin
          </label>
          <select
            value={horaFin}
            onChange={(e) => { setHoraFin(Number(e.target.value)); setSaved(false) }}
            className="bg-white border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            {HORAS_FIN.filter((h) => h > horaInicio).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGuardar}
          disabled={loading}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-70"
        >
          {saved ? '✓ Guardado' : loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
