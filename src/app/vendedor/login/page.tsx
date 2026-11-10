'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VendedorLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    // Mensaje único para credenciales inválidas y cuenta suspendida (Supabase
    // devuelve el mismo error de credenciales para ambos casos, ya que una
    // cuenta "baneada" rechaza el signInWithPassword) — no se diferencia a
    // propósito, para no revelar si el email existe o si está suspendido.
    const MENSAJE_GENERICO = 'No pudimos ingresar. Revisá tus datos o contactá a soporte en hola@klia.com.ar'

    if (authError || !user) {
      console.error('[vendedor/login] signInWithPassword error:', authError)
      if (authError?.status === 429 || authError?.code === 'over_request_rate_limit') {
        setError('Demasiados intentos de inicio de sesión. Esperá unos minutos y volvé a intentar.')
      } else {
        setError(MENSAJE_GENERICO)
      }
      setLoading(false)
      return
    }

    const { error: resumenError } = await supabase.rpc('vendedor_get_resumen')

    if (resumenError) {
      await supabase.auth.signOut()
      setError(MENSAJE_GENERICO)
      setLoading(false)
      return
    }

    window.location.href = '/vendedor'
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-xl font-bold text-[#001a48] mb-1">Panel de vendedores</h1>
        <p className="text-sm text-slate-500 mb-6">Acceso exclusivo para vendedores de KLIA</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001a48]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001a48]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#001a48] text-white font-medium py-2.5 rounded-lg text-sm hover:bg-[#002d72] transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
