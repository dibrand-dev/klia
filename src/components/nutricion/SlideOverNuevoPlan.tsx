'use client'

import { useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'

interface Props {
  pacienteId: string
  pacienteNombre: string
  open: boolean
  onClose: () => void
  onCreado: (planId: string) => void
}

type Modo = 'formula_desarrollada' | 'simple'

export default function SlideOverNuevoPlan({ pacienteId, pacienteNombre, open, onClose, onCreado }: Props) {
  const [nombre, setNombre] = useState('')
  const [modo, setModo] = useState<Modo>('formula_desarrollada')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const res = await fetch('/api/planes-alimentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: pacienteId,
          nombre: nombre.trim() || 'Plan alimentario',
          modo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al crear el plan')
        setCreando(false)
        return
      }
      setNombre('')
      setModo('formula_desarrollada')
      onCreado(data.plan.id)
    } catch {
      setError('Error de conexión. Intentá nuevamente.')
      setCreando(false)
    }
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Nuevo plan alimentario"
      subtitle={pacienteNombre}
      width="md"
      footer={
        <div style={{
          display: 'flex', gap: 8, width: '100%',
          padding: '12px 16px', background: 'var(--surface-2, #F6F7F9)',
          borderTop: '1px solid var(--border, #E7E9EE)',
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crear}
            disabled={creando}
            className="btn primary"
            style={{ flex: 1, display: 'flex', justifyContent: 'center', opacity: creando ? 0.6 : 1 }}
          >
            Crear plan
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
          Nombre del plan
        </label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Plan de mantenimiento — septiembre"
          style={{
            width: '100%', height: 42, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)',
            padding: '0 12px', fontSize: 14.5, color: 'var(--ink, #0B1220)', outline: 'none',
          }}
        />
        <p style={{ fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginTop: 7, lineHeight: 1.5 }}>
          Lo ve el paciente en el PDF del plan.
        </p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
          Modo de carga
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['formula_desarrollada', 'simple'] as Modo[]).map((m) => {
            const sel = modo === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px',
                  border: sel ? '1px solid var(--accent, #1F4FD9)' : '1px solid var(--border, #E7E9EE)',
                  boxShadow: sel ? '0 0 0 3px var(--accent-soft, #EAF0FE)' : 'none',
                  borderRadius: 'var(--r-lg, 12px)', background: 'var(--surface, #fff)',
                  cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: sel ? '5px solid var(--accent, #1F4FD9)' : '1.5px solid var(--border-strong, #D6DAE1)',
                }} />
                <span>
                  <b style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)', marginBottom: 2 }}>
                    {m === 'formula_desarrollada' ? 'Fórmula desarrollada' : 'Simple'}
                  </b>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted, #5B6472)', lineHeight: 1.5 }}>
                    {m === 'formula_desarrollada'
                      ? 'Cargás cada alimento en gramos y KLIA calcula energía y macros en vivo.'
                      : 'Escribís cada comida en texto libre, sin cálculo de macros.'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginTop: 7, lineHeight: 1.5 }}>
          Podés cambiarlo después; los alimentos ya cargados se conservan.
        </p>
        {error && (
          <p style={{ fontSize: 12.5, color: 'var(--danger, #B42318)', marginTop: 10 }}>{error}</p>
        )}
      </div>
    </SlideOver>
  )
}
