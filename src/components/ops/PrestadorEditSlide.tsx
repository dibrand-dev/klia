'use client'

import { useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import { ESPECIALIDADES } from '@/lib/especialidades'
import { PAISES, PAISES_PROVINCIAS } from '@/lib/geografica'
import { cn } from '@/lib/utils'
import { normalizarCuit, validarCuit, formatearCuit } from '@/lib/facturacion/cuit'
import { CONDICIONES_IVA } from '@/lib/facturacion/constantes'

interface Prestador {
  id: string
  nombre: string
  apellido: string
  email: string
  especialidad: string | null
  matricula: string | null
  telefono: string | null
  pais: string | null
  provincia: string | null
  localidad: string | null
  direccion: string | null
  cuit: string | null
  condicion_iva: string | null
  razon_social: string | null
}

interface Props {
  prestador: Prestador
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function PrestadorEditSlide({ prestador, open, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(prestador.nombre)
  const [apellido, setApellido] = useState(prestador.apellido)
  const [especialidad, setEspecialidad] = useState(prestador.especialidad ?? '')
  const [matricula, setMatricula] = useState(prestador.matricula ?? '')
  const [telefono, setTelefono] = useState(prestador.telefono ?? '')
  const [pais, setPais] = useState(prestador.pais ?? '')
  const [provincia, setProvincia] = useState(prestador.provincia ?? '')
  const [localidad, setLocalidad] = useState(prestador.localidad ?? '')
  const [direccion, setDireccion] = useState(prestador.direccion ?? '')
  const [cuit, setCuit] = useState(normalizarCuit(prestador.cuit ?? ''))
  const [condicionIva, setCondicionIva] = useState(prestador.condicion_iva ?? '')
  const [razonSocial, setRazonSocial] = useState(prestador.razon_social ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provincias = pais ? (PAISES_PROVINCIAS[pais] ?? []) : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim()) return
    if (cuit && !validarCuit(cuit)) {
      setError('El CUIT no es válido.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/ops/prestadores/${prestador.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        especialidad: especialidad || null,
        matricula: matricula || null,
        telefono: telefono || null,
        pais: pais || null,
        provincia: provincia || null,
        localidad: localidad || null,
        direccion: direccion || null,
        cuit: cuit || null,
        condicion_iva: condicionIva || null,
        razon_social: razonSocial.trim() || null,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Error al guardar')
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved()
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Editar perfil">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
              Nombre <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
              Apellido <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              required
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={prestador.email}
            readOnly
            className="input-field opacity-60 cursor-not-allowed bg-surface-container"
          />
          <p className="text-[11px] text-on-surface-variant mt-1">El email de acceso no puede editarse desde aquí.</p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Especialidad
          </label>
          <select
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            className="input-field"
          >
            <option value="">Sin especificar</option>
            {ESPECIALIDADES.map((esp) => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Matrícula
          </label>
          <input
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Teléfono
          </label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            País
          </label>
          <select
            value={pais}
            onChange={(e) => { setPais(e.target.value); setProvincia('') }}
            className="input-field"
          >
            <option value="">Sin especificar</option>
            {PAISES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {provincias.length > 0 && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
              Provincia / Estado
            </label>
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              className="input-field"
            >
              <option value="">Sin especificar</option>
              {provincias.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Localidad / Ciudad
          </label>
          <input
            type="text"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Dirección
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            CUIT
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ej: 20-12345678-6"
            maxLength={13}
            value={formatearCuit(cuit)}
            onChange={(e) => setCuit(normalizarCuit(e.target.value))}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Condición frente al IVA
          </label>
          <select
            value={condicionIva}
            onChange={(e) => setCondicionIva(e.target.value)}
            className="input-field"
          >
            <option value="">Sin especificar</option>
            {CONDICIONES_IVA.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Razón social
          </label>
          <input
            type="text"
            maxLength={120}
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 py-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !nombre.trim() || !apellido.trim()}
            className={cn(
              'btn-primary flex-1 py-3',
              (loading || !nombre.trim() || !apellido.trim()) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}
