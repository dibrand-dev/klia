'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { Colegio, CodigoDescuento } from '@/types/database'

interface Props {
  colegiosIniciales: Colegio[]
  codigosIniciales: CodigoDescuento[]
}

function ColegioForm({ colegio, open, onClose, onSaved }: {
  colegio: Colegio | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(colegio?.nombre ?? '')
  const [contactoNombre, setContactoNombre] = useState(colegio?.contacto_nombre ?? '')
  const [contactoEmail, setContactoEmail] = useState(colegio?.contacto_email ?? '')
  const [fechaAcuerdo, setFechaAcuerdo] = useState(colegio?.fecha_acuerdo ?? '')
  const [activo, setActivo] = useState(colegio?.activo ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setLoading(true)
    setError(null)

    const body = {
      nombre: nombre.trim(),
      contacto_nombre: contactoNombre || null,
      contacto_email: contactoEmail || null,
      fecha_acuerdo: fechaAcuerdo || null,
      activo,
    }

    const res = colegio
      ? await fetch(`/api/ops/colegios/${colegio.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/ops/colegios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

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
    <SlideOver open={open} onClose={onClose} title={colegio ? 'Editar colegio' : 'Nuevo colegio'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Nombre <span className="text-error">*</span>
          </label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Contacto — nombre</label>
          <input type="text" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Contacto — email</label>
          <input type="email" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Fecha de acuerdo</label>
          <input type="date" value={fechaAcuerdo} onChange={(e) => setFechaAcuerdo(e.target.value)} className="input-field" />
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Convenio activo
        </label>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || !nombre.trim()}
            className={cn('btn-primary flex-1 py-3', (loading || !nombre.trim()) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

function CodigoForm({ codigo, colegios, open, onClose, onSaved }: {
  codigo: CodigoDescuento | null
  colegios: Colegio[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [colegioId, setColegioId] = useState(codigo?.colegio_id ?? colegios[0]?.id ?? '')
  const [codigoTexto, setCodigoTexto] = useState(codigo?.codigo ?? '')
  const [porcentaje, setPorcentaje] = useState(codigo ? String(codigo.porcentaje_descuento) : '')
  const [usosMaximos, setUsosMaximos] = useState(codigo?.usos_maximos != null ? String(codigo.usos_maximos) : '')
  const [activo, setActivo] = useState(codigo?.activo ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!colegioId || !codigoTexto.trim() || !porcentaje) return
    setLoading(true)
    setError(null)

    const body = {
      colegio_id: colegioId,
      codigo: codigoTexto.trim().toUpperCase(),
      porcentaje_descuento: Number(porcentaje),
      usos_maximos: usosMaximos ? Number(usosMaximos) : null,
      activo,
    }

    const res = codigo
      ? await fetch(`/api/ops/codigos-descuento/${codigo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/ops/codigos-descuento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

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
    <SlideOver open={open} onClose={onClose} title={codigo ? 'Editar código' : 'Nuevo código'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Colegio <span className="text-error">*</span>
          </label>
          <select value={colegioId} onChange={(e) => setColegioId(e.target.value)} required className="input-field">
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Código <span className="text-error">*</span>
          </label>
          <input type="text" value={codigoTexto} onChange={(e) => setCodigoTexto(e.target.value)} required className="input-field" placeholder="Ej: COLEGIOPSI2026" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            % de descuento <span className="text-error">*</span>
          </label>
          <input type="number" min="1" max="100" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Usos máximos (opcional)</label>
          <input type="number" min="1" value={usosMaximos} onChange={(e) => setUsosMaximos(e.target.value)} className="input-field" placeholder="Sin límite" />
          {codigo && (
            <p className="text-[11px] text-on-surface-variant mt-1">Usos actuales: {codigo.usos_actuales}</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Código activo
        </label>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || !colegioId || !codigoTexto.trim() || !porcentaje}
            className={cn('btn-primary flex-1 py-3', (loading || !colegioId || !codigoTexto.trim() || !porcentaje) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

export default function ColegiosClient({ colegiosIniciales, codigosIniciales }: Props) {
  const router = useRouter()
  // Sin useState propio: la lista se refresca vía router.refresh() (server
  // component vuelve a fetchear y pasa props nuevas), no con estado copiado
  // que quedaría desincronizado tras el primer guardado.
  const colegios = colegiosIniciales
  const codigos = codigosIniciales

  const [colegioEditando, setColegioEditando] = useState<Colegio | null>(null)
  const [creandoColegio, setCreandoColegio] = useState(false)
  const [codigoEditando, setCodigoEditando] = useState<CodigoDescuento | null>(null)
  const [creandoCodigo, setCreandoCodigo] = useState(false)

  const [codigoEliminando, setCodigoEliminando] = useState<CodigoDescuento | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [eliminarError, setEliminarError] = useState<string | null>(null)

  function refetch() {
    setColegioEditando(null)
    setCreandoColegio(false)
    setCodigoEditando(null)
    setCreandoCodigo(false)
    router.refresh()
  }

  function abrirEliminarCodigo(cod: CodigoDescuento) {
    setCodigoEliminando(cod)
    setEliminarError(null)
  }

  async function confirmarEliminarCodigo() {
    if (!codigoEliminando) return
    setEliminando(true)
    setEliminarError(null)
    const res = await fetch(`/api/ops/codigos-descuento/${codigoEliminando.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setEliminando(false)
    if (!res.ok) {
      setEliminarError(data.error ?? 'No se pudo eliminar el código.')
      return
    }
    setCodigoEliminando(null)
    router.refresh()
  }

  async function desactivarCodigoEnLugarDeEliminar() {
    if (!codigoEliminando) return
    setEliminando(true)
    const res = await fetch(`/api/ops/codigos-descuento/${codigoEliminando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: false }),
    })
    setEliminando(false)
    if (!res.ok) {
      setEliminarError('No se pudo desactivar el código.')
      return
    }
    setCodigoEliminando(null)
    router.refresh()
  }

  const nombreColegio = (id: string) => colegios.find((c) => c.id === id)?.nombre ?? '—'

  return (
    <div className="space-y-8">
      {/* Colegios */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-on-surface">Colegios profesionales</h2>
          <button onClick={() => setCreandoColegio(true)} className="btn-primary px-4 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo colegio
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Fecha de acuerdo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Códigos</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {colegios.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">No hay colegios cargados.</td></tr>
              )}
              {colegios.map((c) => (
                <tr key={c.id} className="border-b border-outline-variant/10 last:border-0">
                  <td className="px-4 py-3 font-medium text-on-surface">{c.nombre}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.contacto_nombre ?? '—'}{c.contacto_email ? ` · ${c.contacto_email}` : ''}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.fecha_acuerdo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', c.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{codigos.filter((cod) => cod.colegio_id === c.id).length}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setColegioEditando(c)} className="text-primary hover:underline text-sm font-medium">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Códigos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-on-surface">Códigos de descuento</h2>
          <button
            onClick={() => setCreandoCodigo(true)}
            disabled={colegios.length === 0}
            className={cn('btn-primary px-4 py-2 flex items-center gap-2', colegios.length === 0 && 'opacity-50 cursor-not-allowed')}
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo código
          </button>
        </div>
        {colegios.length === 0 && (
          <p className="text-sm text-on-surface-variant mb-3">Creá primero un colegio para poder cargar códigos.</p>
        )}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Colegio</th>
                <th className="px-4 py-3 font-medium">% descuento</th>
                <th className="px-4 py-3 font-medium">Usos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {codigos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">No hay códigos cargados.</td></tr>
              )}
              {codigos.map((cod) => (
                <tr key={cod.id} className="border-b border-outline-variant/10 last:border-0">
                  <td className="px-4 py-3 font-mono font-medium text-on-surface">{cod.codigo}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{nombreColegio(cod.colegio_id)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{cod.porcentaje_descuento}%</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {cod.usos_actuales}{cod.usos_maximos != null ? ` / ${cod.usos_maximos}` : ' (sin límite)'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cod.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {cod.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setCodigoEditando(cod)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        onClick={() => abrirEliminarCodigo(cod)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(creandoColegio || colegioEditando) && (
        <ColegioForm
          colegio={colegioEditando}
          open={true}
          onClose={() => { setCreandoColegio(false); setColegioEditando(null) }}
          onSaved={refetch}
        />
      )}

      {(creandoCodigo || codigoEditando) && (
        <CodigoForm
          codigo={codigoEditando}
          colegios={colegios.filter((c) => c.activo)}
          open={true}
          onClose={() => { setCreandoCodigo(false); setCodigoEditando(null) }}
          onSaved={refetch}
        />
      )}

      {codigoEliminando && (
        codigoEliminando.usos_actuales > 0 ? (
          <ConfirmDialog
            open={true}
            title={`No se puede eliminar "${codigoEliminando.codigo}"`}
            message={
              eliminarError
                ?? `Este código ya fue usado por ${codigoEliminando.usos_actuales} profesional(es), no se puede eliminar — desactivalo en su lugar.`
            }
            confirmLabel={eliminando ? 'Desactivando...' : 'Desactivar en su lugar'}
            cancelLabel="Cancelar"
            variant="warning"
            onConfirm={desactivarCodigoEnLugarDeEliminar}
            onCancel={() => setCodigoEliminando(null)}
          />
        ) : (
          <ConfirmDialog
            open={true}
            title={`Eliminar código "${codigoEliminando.codigo}"`}
            message={eliminarError ?? `¿Confirmás que querés eliminar este código de descuento? Esta acción no se puede deshacer.`}
            confirmLabel={eliminando ? 'Eliminando...' : 'Eliminar'}
            cancelLabel="Cancelar"
            variant="danger"
            onConfirm={confirmarEliminarCodigo}
            onCancel={() => setCodigoEliminando(null)}
          />
        )
      )}
    </div>
  )
}
