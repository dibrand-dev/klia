'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RegistroRefraccion } from '@/types/database'
import { recetaCompleta, formatearDioptrias } from '@/lib/oftalmologia/refraccion'

type Variant = 'standalone' | 'embebida'

interface Props {
  pacienteId: string
  variant?: Variant
}

type FormState = {
  sphOd: string; cylOd: string; axisOd: string; addOd: string; avOd: string
  sphOi: string; cylOi: string; axisOi: string; addOi: string; avOi: string
}

const EMPTY_FORM: FormState = {
  sphOd: '', cylOd: '', axisOd: '', addOd: '', avOd: '',
  sphOi: '', cylOi: '', axisOi: '', addOi: '', avOi: '',
}

function num(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

function Celda({ valor, esDioptria }: { valor: string | number | null; esDioptria?: boolean }) {
  if (valor === null || valor === '') {
    return <span style={{ color: 'var(--muted-3, #AEB5C0)' }}>—</span>
  }
  const display = esDioptria ? formatearDioptrias(Number(valor)) : String(valor)
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display}</span>
}

function RxInput({ value, onChange, placeholder, width = 64 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      style={{
        width,
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'center',
        padding: '8px 6px',
        borderRadius: 8,
        border: '1px solid var(--border, #E2E5EA)',
        background: 'var(--surface, #fff)',
        color: 'var(--ink, #0B1220)',
        fontSize: 13,
      }}
    />
  )
}

export default function RxGrid({ pacienteId, variant = 'standalone' }: Props) {
  const [recetas, setRecetas] = useState<RegistroRefraccion[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [guardando, setGuardando] = useState(false)
  const [collapsed, setCollapsed] = useState(variant === 'embebida')
  const [historialIdx, setHistorialIdx] = useState(0)

  useEffect(() => {
    fetch(`/api/refraccion/listar?pacienteId=${pacienteId}`)
      .then((res) => res.json())
      .then((data) => setRecetas(data.recetas ?? []))
      .finally(() => setLoading(false))
  }, [pacienteId])

  async function handleGuardar() {
    setGuardando(true)
    const res = await fetch('/api/refraccion/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pacienteId,
        sphOd: num(form.sphOd), cylOd: num(form.cylOd), axisOd: num(form.axisOd), addOd: num(form.addOd), avOd: form.avOd || null,
        sphOi: num(form.sphOi), cylOi: num(form.cylOi), axisOi: num(form.axisOi), addOi: num(form.addOi), avOi: form.avOi || null,
      }),
    })
    if (res.ok) {
      const { receta } = await res.json()
      setRecetas((prev) => [receta, ...prev])
      setForm(EMPTY_FORM)
      setHistorialIdx(0)
    }
    setGuardando(false)
  }

  const recetaSeleccionada = recetas[historialIdx] ?? null
  const esMasReciente = historialIdx === 0

  const contenido = (
    <div className="space-y-4">
      {recetas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {recetas.map((r, i) => {
            const completa = recetaCompleta(r)
            return (
              <button
                key={r.id}
                onClick={() => setHistorialIdx(i)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: `1px solid ${i === historialIdx ? 'var(--accent, #1F4FD9)' : 'var(--border, #E2E5EA)'}`,
                  background: i === historialIdx ? 'var(--accent, #1F4FD9)' : 'var(--surface, #fff)',
                  color: i === historialIdx ? '#fff' : 'var(--ink-2, #4A5468)',
                }}
              >
                {format(parseISO(r.created_at), 'd MMM yyyy', { locale: es })} · {completa ? 'Completa' : 'Incompleta'}
              </button>
            )
          })}
        </div>
      )}

      {recetaSeleccionada && !esMasReciente && (
        <div style={{ fontSize: 12.5, color: 'var(--muted-2, #7C8698)', background: 'var(--surface-2, #F5F6F8)', border: '1px solid var(--border, #E2E5EA)', borderRadius: 8, padding: '8px 12px' }}>
          Registro histórico — no editable. Para modificar valores, cargá una nueva receta.
        </div>
      )}

      {recetaSeleccionada ? (
        <>
          <div className="rx-desktop-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--muted-2, #7C8698)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}></th>
                  <th style={{ textAlign: 'center', padding: '6px 8px' }}>SPH</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px' }}>CYL</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px' }}>AXIS</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px' }}>ADD</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px' }}>AV</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: '1px solid var(--border, #E2E5EA)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: 'var(--ink, #0B1220)' }}>OD</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.sph_od} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.cyl_od} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.axis_od} /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.add_od} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.av_od} /></td>
                </tr>
                <tr style={{ borderTop: '1px solid var(--border, #E2E5EA)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: 'var(--ink, #0B1220)' }}>OI</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.sph_oi} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.cyl_oi} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.axis_oi} /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.add_oi} esDioptria /></td>
                  <td style={{ textAlign: 'center', padding: '8px' }}><Celda valor={recetaSeleccionada.av_oi} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rx-mobile-cards" style={{ display: 'none', gap: 10, flexDirection: 'column' }}>
            {([
              { label: 'OD', sph: recetaSeleccionada.sph_od, cyl: recetaSeleccionada.cyl_od, axis: recetaSeleccionada.axis_od, add: recetaSeleccionada.add_od, av: recetaSeleccionada.av_od },
              { label: 'OI', sph: recetaSeleccionada.sph_oi, cyl: recetaSeleccionada.cyl_oi, axis: recetaSeleccionada.axis_oi, add: recetaSeleccionada.add_oi, av: recetaSeleccionada.av_oi },
            ] as const).map((ojo) => (
              <div key={ojo.label} style={{ border: '1px solid var(--border, #E2E5EA)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #0B1220)', marginBottom: 8 }}>{ojo.label}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12.5 }}>
                  <div><span style={{ color: 'var(--muted-2, #7C8698)' }}>SPH </span><Celda valor={ojo.sph} esDioptria /></div>
                  <div><span style={{ color: 'var(--muted-2, #7C8698)' }}>CYL </span><Celda valor={ojo.cyl} esDioptria /></div>
                  <div><span style={{ color: 'var(--muted-2, #7C8698)' }}>AXIS </span><Celda valor={ojo.axis} /></div>
                  <div><span style={{ color: 'var(--muted-2, #7C8698)' }}>ADD </span><Celda valor={ojo.add} esDioptria /></div>
                  <div><span style={{ color: 'var(--muted-2, #7C8698)' }}>AV </span><Celda valor={ojo.av} /></div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : !loading && (
        <p style={{ fontSize: 13, color: 'var(--muted-2, #7C8698)' }}>Sin recetas cargadas todavía.</p>
      )}

      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink, #0B1220)', marginBottom: 8 }}>Nueva receta</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted-2, #7C8698)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}></th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>SPH</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>CYL</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>AXIS</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>ADD</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>AV</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>OD</td>
                <td style={{ padding: '6px' }}><RxInput value={form.sphOd} onChange={(v) => setForm((f) => ({ ...f, sphOd: v }))} placeholder="+0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.cylOd} onChange={(v) => setForm((f) => ({ ...f, cylOd: v }))} placeholder="-0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.axisOd} onChange={(v) => setForm((f) => ({ ...f, axisOd: v }))} placeholder="0°" width={52} /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.addOd} onChange={(v) => setForm((f) => ({ ...f, addOd: v }))} placeholder="+0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.avOd} onChange={(v) => setForm((f) => ({ ...f, avOd: v }))} placeholder="10/10" width={56} /></td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>OI</td>
                <td style={{ padding: '6px' }}><RxInput value={form.sphOi} onChange={(v) => setForm((f) => ({ ...f, sphOi: v }))} placeholder="+0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.cylOi} onChange={(v) => setForm((f) => ({ ...f, cylOi: v }))} placeholder="-0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.axisOi} onChange={(v) => setForm((f) => ({ ...f, axisOi: v }))} placeholder="0°" width={52} /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.addOi} onChange={(v) => setForm((f) => ({ ...f, addOi: v }))} placeholder="+0.00" /></td>
                <td style={{ padding: '6px' }}><RxInput value={form.avOi} onChange={(v) => setForm((f) => ({ ...f, avOi: v }))} placeholder="10/10" width={56} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="btn-primary"
          style={{ marginTop: 10, fontSize: 13, padding: '8px 16px', opacity: guardando ? 0.6 : 1 }}
        >
          {guardando ? 'Guardando...' : 'Guardar receta'}
        </button>
      </div>
    </div>
  )

  if (variant === 'embebida') {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ink, #0B1220)',
          }}
        >
          Refracción
          <span className="material-symbols-outlined" style={{ fontSize: 18, transform: collapsed ? 'none' : 'rotate(180deg)' }}>expand_more</span>
        </button>
        {!collapsed && (
          <div style={{ padding: '0 16px 16px', maxWidth: 520 }}>
            {loading ? <p style={{ fontSize: 13, color: 'var(--muted-2, #7C8698)' }}>Cargando...</p> : contenido}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-5 rx-standalone">
      {loading ? <p style={{ fontSize: 13, color: 'var(--muted-2, #7C8698)' }}>Cargando...</p> : contenido}
      <style jsx>{`
        @media (max-width: 460px) {
          .rx-standalone :global(.rx-desktop-table) {
            display: none;
          }
          .rx-standalone :global(.rx-mobile-cards) {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  )
}
