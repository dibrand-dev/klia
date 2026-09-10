'use client'

import { useEffect, useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PALETTE } from '@/lib/sedes/horarios'
import type { Sucursal } from '@/types/database'

// tieneTurnos es derivado (no una columna de sucursales) — lo agrega
// GET /api/sedes contando turnos.sucursal_id, no persiste en la tabla.
type SucursalConTurnos = Sucursal & { tieneTurnos?: boolean }

const ICON_PIN = (
  <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
)
const ICON_CAM = (
  <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    <rect x="2.5" y="6.5" width="12" height="11" rx="2" /><path d="M14.5 11l7-3.5v9l-7-3.5z" />
  </svg>
)

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.06em' }
const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 38, font: 'inherit', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', width: '100%' }
const hintStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted-2)', lineHeight: 1.5 }

interface Props {
  open: boolean
  onClose: () => void
  sede: SucursalConTurnos | null
  coloresUsados: string[]
  onSaved: (sede: Sucursal) => void
  onDeleted: (id: string) => void
}

export default function SedeSlideOver({ open, onClose, sede, coloresUsados, onSaved, onDeleted }: Props) {
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [esOnline, setEsOnline] = useState(false)
  const [color, setColor] = useState(PALETTE[0].c)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    if (!open) return
    if (sede) {
      setNombre(sede.nombre)
      setDireccion(sede.direccion ?? '')
      setEsOnline(sede.es_online)
      setColor(sede.color)
    } else {
      const disponible = PALETTE.find(p => !coloresUsados.includes(p.c)) ?? PALETTE[0]
      setNombre('')
      setDireccion('')
      setEsOnline(false)
      setColor(disponible.c)
    }
    setError(null)
  }, [open, sede, coloresUsados])

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre de la sede es obligatorio'); return }
    setLoading(true)
    setError(null)
    try {
      const body = { nombre: nombre.trim(), direccion: esOnline ? null : direccion.trim(), es_online: esOnline, color }
      const res = await fetch(sede ? `/api/sedes/${sede.id}` : '/api/sedes', {
        method: sede ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'limite_alcanzado' ? 'Llegaste al límite de sedes de tu plan' : (data.error ?? 'Error al guardar la sede'))
        setLoading(false)
        return
      }
      onSaved(data.sede)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!sede) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/sedes/${sede.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted(sede.id)
        setConfirmarEliminar(false)
        onClose()
      } else {
        const data = await res.json()
        setError(data.error === 'tiene_turnos' ? 'Esta sede tiene turnos registrados — no se puede eliminar, pero podés desactivarla.' : (data.error ?? 'Error al eliminar la sede'))
        setConfirmarEliminar(false)
      }
    } finally {
      setEliminando(false)
    }
  }

  const tomados = coloresUsados.filter(c => c !== sede?.color)

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={sede ? 'Editar sede' : 'Nueva sede'}
        subtitle={sede ? undefined : 'Se agrega a tu agenda al guardar'}
        width="md"
        header={
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: `color-mix(in oklab, ${color} 12%, white)`, color,
              border: `1px solid color-mix(in oklab, ${color} 24%, white)`,
            }}>
              {esOnline ? ICON_CAM : ICON_PIN}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>{sede ? 'Editar sede' : 'Nueva sede'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sede ? `${sede.nombre}` : 'Se agrega a tu agenda al guardar'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid transparent', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--ink-2)', strokeWidth: 1.9, fill: 'none' }}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            {sede && sede.tieneTurnos ? (
              <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4, maxWidth: 240 }}>
                Esta sede tiene turnos registrados — no se puede eliminar, pero podés desactivarla.
              </span>
            ) : sede && (
              <button
                type="button"
                onClick={() => setConfirmarEliminar(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                Eliminar sede
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Guardando...' : sede ? 'Guardar cambios' : 'Guardar sede'}
            </button>
          </div>
        }
      >
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="sede-nombre">Nombre de la sede<em style={{ color: 'var(--danger)', fontStyle: 'normal', fontWeight: 700, marginLeft: 2 }}>*</em></label>
          <input id="sede-nombre" type="text" style={inputStyle} placeholder="Ej. Consultorio Palermo" value={nombre} onChange={e => setNombre(e.target.value)} />
          <span style={hintStyle}>Así la vas a ver en la agenda y en tu link público.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Es modalidad online</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>Para videoconsultas. No lleva dirección física.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={esOnline}
            onClick={() => setEsOnline(v => !v)}
            style={{ position: 'relative', width: 38, height: 22, flexShrink: 0, background: esOnline ? 'var(--ink)' : 'var(--border-strong)', borderRadius: 100, cursor: 'pointer', border: 'none', transition: 'background .15s ease' }}
          >
            <span style={{ position: 'absolute', top: 2, left: esOnline ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.15)', display: 'block' }} />
          </button>
        </div>

        {!esOnline && (
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="sede-direccion">Dirección</label>
            <input id="sede-direccion" type="text" style={inputStyle} placeholder="Calle, número, piso" value={direccion} onChange={e => setDireccion(e.target.value)} />
            <span style={hintStyle}>Opcional. Se muestra al paciente cuando reserva un turno.</span>
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>Color identificador</label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {PALETTE.map(p => {
              const taken = tomados.includes(p.c)
              const selected = color === p.c
              return (
                <button
                  key={p.c}
                  type="button"
                  disabled={taken}
                  title={taken ? `${p.n} — en uso` : p.n}
                  onClick={() => !taken && setColor(p.c)}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    border: '1px solid rgba(14,20,48,.12)',
                    cursor: taken ? 'not-allowed' : 'pointer',
                    position: 'relative', padding: 0,
                    background: p.c,
                    opacity: taken ? 0.32 : 1,
                    boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 4px ${p.c}` : 'none',
                  }}
                >
                  {selected && (
                    <span style={{
                      position: 'absolute', left: '50%', top: '50%',
                      width: 11, height: 6,
                      borderLeft: '2px solid #fff', borderBottom: '2px solid #fff',
                      transform: 'translate(-50%, -70%) rotate(-45deg)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>
          <span style={hintStyle}>Este color identifica la sede en toda la agenda. Los atenuados ya están en uso.</span>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={confirmarEliminar}
        title="Eliminar sede"
        message={`¿Eliminar "${sede?.nombre}"? Se van a borrar también sus horarios configurados. Esta acción no se puede deshacer.`}
        confirmLabel={eliminando ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmarEliminar(false)}
      />
    </>
  )
}
