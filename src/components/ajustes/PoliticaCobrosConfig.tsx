'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PoliticaCobrosConfig({
  cobrarInasistenciasInicial,
}: {
  cobrarInasistenciasInicial: boolean
}) {
  const [cobrar, setCobrar] = useState(cobrarInasistenciasInicial)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  async function handleToggle() {
    const nuevoValor = !cobrar
    setCobrar(nuevoValor)
    setGuardando(true)
    setGuardado(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ cobrar_inasistencias: nuevoValor }).eq('id', user.id)
    }
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="material-symbols-outlined text-2xl text-primary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
          payments
        </span>
        <div>
          <h2 className="text-sm font-bold text-on-surface">Política de cobros</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Define cómo se calculan las deudas de tus pacientes
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-t border-outline-variant/10">
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium text-on-surface">Cobrar sesiones no asistidas</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Si está activo, las sesiones marcadas como <span className="font-medium">&ldquo;No asistió&rdquo;</span> se incluyen
            en la deuda del paciente. Podés configurar excepciones por paciente.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={guardando}
          aria-pressed={cobrar}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 ${
            cobrar ? 'bg-primary' : 'bg-outline-variant/40'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              cobrar ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {guardado && (
        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Configuración guardada
        </p>
      )}
    </div>
  )
}
