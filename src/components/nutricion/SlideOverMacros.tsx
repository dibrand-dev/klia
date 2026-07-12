'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SlideOver from '@/components/ui/SlideOver'
import { redistribuirMacros, gramosDesdeMacro, type MacrosPct } from '@/lib/nutricion/calculos'

interface Props {
  pacienteId: string
  open: boolean
  onClose: () => void
}

const MACRO_DEFS: { key: keyof MacrosPct; name: string; color: string; kcalPorGramo: 4 | 9 }[] = [
  { key: 'cho', name: 'Carbohidratos', color: 'var(--macro-cho, var(--accent, #1F4FD9))', kcalPorGramo: 4 },
  { key: 'prot', name: 'Proteínas', color: 'var(--macro-prot, var(--violet, #5B3DC9))', kcalPorGramo: 4 },
  { key: 'gra', name: 'Grasas', color: 'var(--macro-gra, var(--warn, #A65A06))', kcalPorGramo: 9 },
]

const DEFAULT_MACROS: MacrosPct = { cho: 45, prot: 30, gra: 25 }

export default function SlideOverMacros({ pacienteId, open, onClose }: Props) {
  const [macros, setMacros] = useState<MacrosPct>(DEFAULT_MACROS)
  const [kcal, setKcal] = useState<number | null>(1850)
  const [loading, setLoading] = useState(true)
  const [checkKey, setCheckKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    async function fetchMacros() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('distribucion_macros')
        .select('*')
        .eq('paciente_id', pacienteId)
        .maybeSingle()
      if (cancelado) return
      if (data) {
        setMacros({
          cho: Number(data.porcentaje_carbohidratos),
          prot: Number(data.porcentaje_proteinas),
          gra: Number(data.porcentaje_grasas),
        })
        setKcal(data.kcal_objetivo != null ? Number(data.kcal_objetivo) : null)
      } else {
        setMacros(DEFAULT_MACROS)
        setKcal(1850)
      }
      setLoading(false)
    }
    fetchMacros()
    return () => { cancelado = true }
  }, [pacienteId, open])

  function mostrarCheck(key: string) {
    setCheckKey(key)
    window.setTimeout(() => setCheckKey((k) => (k === key ? null : k)), 1000)
  }

  async function guardar(nuevosMacros: MacrosPct, nuevoKcal: number | null, checkKeyId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('distribucion_macros').upsert({
      paciente_id: pacienteId,
      terapeuta_id: user.id,
      porcentaje_carbohidratos: nuevosMacros.cho,
      porcentaje_proteinas: nuevosMacros.prot,
      porcentaje_grasas: nuevosMacros.gra,
      kcal_objetivo: nuevoKcal,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'paciente_id' })
    mostrarCheck(checkKeyId)
  }

  function handleSetMacro(key: keyof MacrosPct, rawVal: number) {
    const next = redistribuirMacros(macros, key, rawVal)
    setMacros(next)
    guardar(next, kcal, key)
  }

  function handleKcalChange(v: string) {
    const parsed = v.trim() === '' ? null : Number(v)
    setKcal(parsed)
  }

  function handleKcalBlur() {
    guardar(macros, kcal, 'kcal')
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Distribución de macronutrientes"
      subtitle="Objetivo diario de kcal y proporción de macros"
      width="md"
      footer={
        <div
          style={{
            borderTop: '1px solid var(--border, #E7E9EE)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface-2, #F6F7F9)',
            fontSize: 11.5,
            color: 'var(--muted-2, #8A93A1)',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok, #0E8A5F)', display: 'inline-block' }} />
          Se guarda automáticamente
        </div>
      }
    >
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando...</p>
      ) : (
        <>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Kcal objetivo diario
            </label>
            <div style={{ position: 'relative', maxWidth: 220 }}>
              <input
                type="number"
                step={10}
                min={0}
                value={kcal ?? ''}
                onChange={(e) => handleKcalChange(e.target.value)}
                onBlur={handleKcalBlur}
                className="kcal-input-no-spinner"
                style={{
                  width: '100%', height: 42, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)',
                  padding: '0 56px 0 12px', fontSize: 16, fontWeight: 600, color: 'var(--ink, #0B1220)',
                  background: 'var(--surface, #fff)', outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent, #1F4FD9)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft, #EAF0FE)' }}
                onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border, #E7E9EE)'; e.target.style.boxShadow = 'none' }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted-2, #8A93A1)', fontWeight: 500, pointerEvents: 'none' }}>
                kcal
              </span>
              <style jsx>{`
                .kcal-input-no-spinner::-webkit-outer-spin-button,
                .kcal-input-no-spinner::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                .kcal-input-no-spinner {
                  -moz-appearance: textfield;
                }
              `}</style>
            </div>
          </div>

          {MACRO_DEFS.map((m) => (
            <MacroRow
              key={m.key}
              def={m}
              value={macros[m.key]}
              onChange={(v) => handleSetMacro(m.key, v)}
              showCheck={checkKey === m.key}
            />
          ))}

          <div style={{ display: 'flex', height: 40, borderRadius: 'var(--r-md, 8px)', overflow: 'hidden', background: 'var(--surface-3, #F1F3F6)', marginTop: 6, border: '1px solid var(--border, #E7E9EE)' }}>
            {MACRO_DEFS.map((m) => {
              const grams = gramosDesdeMacro(kcal, macros[m.key], m.kcalPorGramo)
              return (
                <div
                  key={m.key}
                  title={`${m.name}: ${macros[m.key]}% · ${grams} g`}
                  style={{
                    width: `${macros[m.key]}%`, background: m.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                >
                  {macros[m.key]}% <span style={{ fontWeight: 500, opacity: 0.85, marginLeft: 4 }}>{grams} g</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted-2, #8A93A1)' }}>
            <span>Carbohidratos y proteínas: 4 kcal/g</span>
            <span>Grasas: 9 kcal/g</span>
          </div>
        </>
      )}
    </SlideOver>
  )
}

function MacroRow({
  def, value, onChange, showCheck,
}: {
  def: { key: keyof MacrosPct; name: string; color: string }
  value: number
  onChange: (v: number) => void
  showCheck: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  function valueFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return value
    const pct = ((clientX - rect.left) / rect.width) * 100
    return Math.max(0, Math.min(100, pct))
  }

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true
    onChange(valueFromClientX(e.clientX))
    function onMove(ev: PointerEvent) {
      if (!draggingRef.current) return
      onChange(valueFromClientX(ev.clientX))
    }
    function onUp() {
      draggingRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: def.color, flex: 'none' }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)', flex: 1 }}>{def.name}</span>
        {showCheck && (
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--ok-soft, #E7F5EE)', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: 'var(--ok, #0E8A5F)', strokeWidth: 2.6, fill: 'none' }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        )}
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange(v)
            }}
            className="macro-pct-no-spinner"
            style={{
              width: 58, height: 30, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-sm, 6px)',
              padding: '0 18px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink, #0B1220)',
              background: 'var(--surface, #fff)', outline: 'none', textAlign: 'right',
            }}
          />
          <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted-2, #8A93A1)', pointerEvents: 'none' }}>%</span>
          <style jsx>{`
            .macro-pct-no-spinner::-webkit-outer-spin-button,
            .macro-pct-no-spinner::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            .macro-pct-no-spinner {
              -moz-appearance: textfield;
            }
          `}</style>
        </div>
      </div>
      <div
        style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <div ref={trackRef} style={{ position: 'relative', width: '100%', height: 8, borderRadius: 100, background: 'var(--surface-3, #F1F3F6)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 100, width: `${value}%`, background: def.color }} />
          <div
            style={{
              position: 'absolute', top: '50%', left: `${value}%`, width: 18, height: 18, borderRadius: '50%',
              background: 'var(--surface, #fff)', border: `2.5px solid ${def.color}`, transform: 'translate(-50%, -50%)',
              boxShadow: 'var(--shadow-sm, 0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04))',
            }}
          />
        </div>
      </div>
    </div>
  )
}
