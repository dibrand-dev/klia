'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ESPECIALIDADES } from '@/lib/especialidades'

export default function RegisterForm() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    especialidad: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
        especialidad: form.especialidad || null,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(
        body.error === 'already_registered'
          ? 'Ese email ya está registrado. ¿Querés iniciar sesión?'
          : 'Error al crear la cuenta. Intentá de nuevo.'
      )
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">¡Cuenta creada!</h3>
        <p className="text-gray-600 text-sm">
          Te enviamos un email de confirmación a <strong>{form.email}</strong>.
          Revisá tu bandeja de entrada para activar tu cuenta.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre
          </label>
          <input
            id="nombre" name="nombre" type="text"
            value={form.nombre} onChange={handleChange}
            required placeholder="María" className="input-field"
          />
        </div>
        <div>
          <label htmlFor="apellido" className="block text-sm font-medium text-gray-700 mb-1">
            Apellido
          </label>
          <input
            id="apellido" name="apellido" type="text"
            value={form.apellido} onChange={handleChange}
            required placeholder="García" className="input-field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="especialidad" className="block text-sm font-medium text-gray-700 mb-1">
          Especialidad
        </label>
        <select
          id="especialidad" name="especialidad"
          value={form.especialidad} onChange={handleChange}
          required className="input-field"
        >
          <option value="">Seleccioná tu especialidad...</option>
          {ESPECIALIDADES.map((esp) => (
            <option key={esp} value={esp}>{esp}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email profesional
        </label>
        <input
          id="email" name="email" type="email"
          value={form.email} onChange={handleChange}
          required placeholder="tu@email.com" className="input-field"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="password" name="password" type="password"
          value={form.password} onChange={handleChange}
          required placeholder="Mínimo 8 caracteres" className="input-field"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword" name="confirmPassword" type="password"
          value={form.confirmPassword} onChange={handleChange}
          required placeholder="Repetí la contraseña" className="input-field"
        />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Al registrarte aceptás los Términos y Condiciones de KLIA.
        Transcurrido el período de prueba, podrás elegir el plan que mejor se adapte a tu consultorio.
      </p>

      <button
        type="submit"
        disabled={loading}
        className={cn('btn-primary w-full py-2.5 mt-2', loading && 'opacity-70 cursor-not-allowed')}
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta gratuita'}
      </button>

      <p className="text-center text-sm text-gray-600">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-primary hover:text-primary-container font-medium">
          Iniciá sesión
        </Link>
      </p>
    </form>
  )
}
