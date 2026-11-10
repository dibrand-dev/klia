'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { Colegio, Database } from '@/types/database'

type VendedorOps = Database['public']['Functions']['ops_get_vendedores']['Returns'][number]

interface Props {
  vendedoresIniciales: VendedorOps[]
  colegiosDisponibles: Colegio[]
}

function moneda(n: number): string {
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

function AltaVendedorForm({ colegios, open, onClose, onSaved }: {
  colegios: Colegio[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [colegioId, setColegioId] = useState(colegios[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim() || !email.trim() || !colegioId) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/ops/vendedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim(), colegio_id: colegioId }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al crear el vendedor')
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved()
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Alta de vendedor">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {colegios.length === 0 && (
          <p className="text-sm text-on-surface-variant">No hay colegios disponibles — todos ya tienen un vendedor asignado, o no hay colegios activos cargados.</p>
        )}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Nombre <span className="text-error">*</span>
          </label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Apellido <span className="text-error">*</span>
          </label>
          <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Email <span className="text-error">*</span>
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Colegio <span className="text-error">*</span>
          </label>
          <select value={colegioId} onChange={(e) => setColegioId(e.target.value)} required disabled={colegios.length === 0} className="input-field">
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || colegios.length === 0 || !nombre.trim() || !apellido.trim() || !email.trim()}
            className={cn('btn-primary flex-1 py-3', (loading || colegios.length === 0 || !nombre.trim() || !apellido.trim() || !email.trim()) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Creando...' : 'Crear vendedor'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

function EditarVendedorForm({ vendedor, open, onClose, onSaved }: {
  vendedor: VendedorOps
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(vendedor.nombre)
  const [apellido, setApellido] = useState(vendedor.apellido)
  const [comisionPct, setComisionPct] = useState(String(vendedor.comision_pct))
  const [mesesComision, setMesesComision] = useState(String(vendedor.meses_comision))
  const [diasColchon, setDiasColchon] = useState(String(vendedor.dias_colchon))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim() || !comisionPct || !mesesComision || !diasColchon) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/ops/vendedores/${vendedor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        comision_pct: Number(comisionPct),
        meses_comision: Number(mesesComision),
        dias_colchon: Number(diasColchon),
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al guardar')
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved()
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Editar vendedor">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Nombre <span className="text-error">*</span>
          </label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Apellido <span className="text-error">*</span>
          </label>
          <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Email</label>
          <input type="email" value={vendedor.email} disabled className="input-field opacity-60 cursor-not-allowed" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Código</label>
          <input type="text" value={vendedor.codigo ?? '—'} disabled className="input-field opacity-60 cursor-not-allowed font-mono" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Comisión % <span className="text-error">*</span>
          </label>
          <input type="number" min="0" max="100" step="0.01" value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Meses de comisión <span className="text-error">*</span>
          </label>
          <input type="number" min="1" max="60" step="1" value={mesesComision} onChange={(e) => setMesesComision(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Días de colchón <span className="text-error">*</span>
          </label>
          <input type="number" min="0" max="365" step="1" value={diasColchon} onChange={(e) => setDiasColchon(e.target.value)} required className="input-field" />
        </div>

        <p className="text-[11px] text-on-surface-variant">
          Cambiar la comisión % o los meses de comisión solo aplica a las comisiones que se generen a partir de ahora — las ya generadas guardan el % con el que se calcularon.
        </p>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || !nombre.trim() || !apellido.trim() || !comisionPct || !mesesComision || !diasColchon}
            className={cn('btn-primary flex-1 py-3', (loading || !nombre.trim() || !apellido.trim() || !comisionPct || !mesesComision || !diasColchon) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

function LiquidarForm({ vendedor, open, onClose, onSaved }: {
  vendedor: VendedorOps
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/ops/vendedores/${vendedor.id}/liquidar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notas: notas.trim() || undefined }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.success === false) {
      setError(json.error ?? 'No se pudo liquidar al vendedor.')
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved()
  }

  return (
    <SlideOver open={open} onClose={onClose} title={`Liquidar — ${vendedor.nombre} ${vendedor.apellido}`}>
      <div className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-surface-container-low rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1">Comisión liquidable</p>
          <p className="text-2xl font-bold text-on-surface">{moneda(vendedor.comision_liquidable)}</p>
        </div>

        <p className="text-sm text-on-surface-variant">
          Esto marca como liquidadas todas las comisiones devengadas/confirmadas de este vendedor que ya pasaron su colchón de días. No se puede deshacer.
        </p>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Notas (opcional)</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="input-field" placeholder="Ej: transferencia del 10/11" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || vendedor.comision_liquidable <= 0}
            className={cn('btn-primary flex-1 py-3', (loading || vendedor.comision_liquidable <= 0) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Liquidando...' : 'Confirmar liquidación'}
          </button>
        </div>
      </div>
    </SlideOver>
  )
}

export default function VendedoresClient({ vendedoresIniciales, colegiosDisponibles }: Props) {
  const router = useRouter()
  const vendedores = vendedoresIniciales

  const [creando, setCreando] = useState(false)
  const [liquidando, setLiquidando] = useState<VendedorOps | null>(null)
  const [editando, setEditando] = useState<VendedorOps | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState<VendedorOps | null>(null)
  const [cambiandoEstadoLoading, setCambiandoEstadoLoading] = useState(false)
  const [cambiandoEstadoError, setCambiandoEstadoError] = useState<string | null>(null)

  function refetch() {
    setCreando(false)
    setLiquidando(null)
    setEditando(null)
    router.refresh()
  }

  async function confirmarCambioEstado() {
    if (!cambiandoEstado) return
    setCambiandoEstadoLoading(true)
    setCambiandoEstadoError(null)

    const res = await fetch(`/api/ops/vendedores/${cambiandoEstado.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !cambiandoEstado.activo }),
    })

    const json = await res.json().catch(() => ({}))
    setCambiandoEstadoLoading(false)
    if (!res.ok) {
      setCambiandoEstadoError(json.error ?? 'No se pudo actualizar el estado del vendedor.')
      return
    }

    setCambiandoEstado(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-on-surface">Vendedores</h2>
        <button onClick={() => setCreando(true)} className="btn-primary px-4 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">add</span>
          Alta de vendedor
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Registrados</th>
              <th className="px-4 py-3 font-medium">Pagando</th>
              <th className="px-4 py-3 font-medium">Por liquidar</th>
              <th className="px-4 py-3 font-medium">Liquidable</th>
              <th className="px-4 py-3 font-medium">Liquidada</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {vendedores.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-on-surface-variant">No hay vendedores cargados.</td></tr>
            )}
            {vendedores.map((v) => (
              <tr key={v.id} className="border-b border-outline-variant/10 last:border-0">
                <td className="px-4 py-3 font-medium text-on-surface">{v.nombre} {v.apellido}<br /><span className="text-xs text-on-surface-variant font-normal">{v.email}</span></td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{v.codigo ?? '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{v.registrados}</td>
                <td className="px-4 py-3 text-on-surface-variant">{v.pagando}</td>
                <td className="px-4 py-3 text-on-surface-variant">{moneda(v.comision_por_liquidar)}</td>
                <td className="px-4 py-3 font-medium text-on-surface">{moneda(v.comision_liquidable)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{moneda(v.comision_liquidada)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', v.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {v.activo ? 'Activo' : 'Suspendido'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setEditando(v)} className="text-primary hover:underline text-sm font-medium">
                      Editar
                    </button>
                    <button
                      onClick={() => { setCambiandoEstadoError(null); setCambiandoEstado(v) }}
                      className={cn('hover:underline text-sm font-medium', v.activo ? 'text-red-600' : 'text-green-700')}
                    >
                      {v.activo ? 'Suspender' : 'Reactivar'}
                    </button>
                    <button
                      onClick={() => setLiquidando(v)}
                      disabled={v.comision_liquidable <= 0}
                      className={cn('text-primary hover:underline text-sm font-medium', v.comision_liquidable <= 0 && 'opacity-40 cursor-not-allowed hover:no-underline')}
                    >
                      Liquidar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creando && (
        <AltaVendedorForm
          colegios={colegiosDisponibles}
          open={true}
          onClose={() => setCreando(false)}
          onSaved={refetch}
        />
      )}

      {liquidando && (
        <LiquidarForm
          vendedor={liquidando}
          open={true}
          onClose={() => setLiquidando(null)}
          onSaved={refetch}
        />
      )}

      {editando && (
        <EditarVendedorForm
          vendedor={editando}
          open={true}
          onClose={() => setEditando(null)}
          onSaved={refetch}
        />
      )}

      {cambiandoEstado && (
        <ConfirmDialog
          open={true}
          title={cambiandoEstado.activo ? `Suspender a ${cambiandoEstado.nombre} ${cambiandoEstado.apellido}` : `Reactivar a ${cambiandoEstado.nombre} ${cambiandoEstado.apellido}`}
          message={
            cambiandoEstadoError
              ?? (cambiandoEstado.activo
                ? `${cambiandoEstado.nombre} no podrá ingresar ni ver datos. Las comisiones ya generadas se conservan.`
                : `${cambiandoEstado.nombre} va a poder volver a ingresar a su panel.`)
          }
          confirmLabel={cambiandoEstadoLoading ? 'Guardando...' : (cambiandoEstado.activo ? 'Suspender' : 'Reactivar')}
          cancelLabel="Cancelar"
          variant={cambiandoEstado.activo ? 'danger' : 'default'}
          onConfirm={confirmarCambioEstado}
          onCancel={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  )
}
