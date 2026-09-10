'use client'

import { limiteSedes } from '@/lib/sedes/horarios'
import type { HorarioSucursal, Sucursal } from '@/types/database'

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
const ICON_PLUS = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>
)
const ICON_LOCK = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
)

const PLAN_NAME: Record<string, string> = { esencial: 'Esencial', profesional: 'Profesional', premium: 'Premium', bonificado: 'Bonificado' }

interface Props {
  sedes: Sucursal[]
  horariosPorSede: Record<string, HorarioSucursal[]>
  plan: string
  onAdd: () => void
  onEdit: (sede: Sucursal) => void
  onVerHorario: (sede: Sucursal) => void
  onToggleActivo: (sede: Sucursal) => void
}

export default function SedesSection({ sedes, horariosPorSede, plan, onAdd, onEdit, onVerHorario, onToggleActivo }: Props) {
  const limite = limiteSedes(plan)
  const atLimit = sedes.length >= limite

  function nBlocks(sede: Sucursal): { bloques: number; dias: number } {
    const horarios = horariosPorSede[sede.id] ?? []
    const diasConBloque = new Set(horarios.map(h => h.dia_semana))
    return { bloques: horarios.length, dias: diasConBloque.size }
  }

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 26px', scrollMarginTop: 80 }} id="sedes">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-soft)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {ICON_PIN}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', margin: 0, color: 'var(--ink)' }}>Sedes</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Los lugares donde atendés. Cada sede tiene su propio horario y su color en la agenda.</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 100, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>
            Plan <b style={{ color: 'var(--ink-2)', fontWeight: 700 }}>{PLAN_NAME[plan] ?? plan}</b> · {limite === Infinity ? 'sedes ilimitadas' : `${sedes.length} de ${limite} ${limite === 1 ? 'sede' : 'sedes'}`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sedes.map(s => {
          const { bloques, dias } = nBlocks(s)
          return (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                border: '1px solid var(--border)', borderRadius: 12,
                background: s.activo ? 'var(--surface)' : 'var(--surface-2)',
                borderLeft: `4px solid ${s.activo ? s.color : 'var(--border-strong)'}`,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: s.activo ? `color-mix(in oklab, ${s.color} 12%, white)` : 'var(--surface-3)',
                color: s.activo ? s.color : 'var(--muted-2)',
                border: `1px solid ${s.activo ? `color-mix(in oklab, ${s.color} 24%, white)` : 'var(--border)'}`,
              }}>
                {s.es_online ? ICON_CAM : ICON_PIN}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-.005em', color: s.activo ? 'var(--ink)' : 'var(--muted)' }}>{s.nombre}</b>
                  {s.es_online && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--violet-soft, #EEEAFB)', color: '#4A2FA8' }}>Online</span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.activo ? 'var(--ok-soft)' : 'var(--surface-3)', color: s.activo ? 'var(--ok)' : 'var(--muted)' }}>
                    {s.activo && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
                    {s.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {s.es_online ? 'Videoconsulta · sin dirección' : (s.direccion || 'Sin dirección cargada')}
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-3)' }} />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{bloques} bloques en {dias} días</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => onVerHorario(s)} style={{ padding: '6px 11px', fontSize: 12.5, borderRadius: 8, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>Horario</button>
                <button type="button" onClick={() => onEdit(s)} style={{ padding: '6px 11px', fontSize: 12.5, borderRadius: 8, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>Editar</button>
                <button
                  type="button" role="switch" aria-checked={s.activo} aria-label="Sede activa"
                  onClick={() => onToggleActivo(s)}
                  style={{ position: 'relative', width: 38, height: 22, flexShrink: 0, background: s.activo ? 'var(--ink)' : 'var(--border-strong)', borderRadius: 100, cursor: 'pointer', border: 'none', transition: 'background .15s ease' }}
                >
                  <span style={{ position: 'absolute', top: 2, left: s.activo ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.15)', display: 'block' }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {atLimit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: '1px dashed var(--border-strong)', borderRadius: 12, background: 'var(--surface-2)', marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            <b style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 1 }}>Llegaste al límite de tu plan</b>
            {PLAN_NAME[plan] ?? plan} incluye {limite} {limite === 1 ? 'sede' : 'sedes'}.
          </div>
          <button type="button" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', opacity: 0.55, cursor: 'not-allowed' }}>
            {ICON_LOCK} Agregar sede
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: '1px dashed var(--border-strong)', borderRadius: 12, background: 'var(--surface-2)', marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            <b style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 1 }}>¿Atendés en otro lugar?</b>
            Podés agregar {limite === Infinity ? 'todas las sedes que necesites' : `hasta ${limite - sedes.length} sede${limite - sedes.length > 1 ? 's' : ''} más`} en tu plan {PLAN_NAME[plan] ?? plan}.
          </div>
          <button type="button" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white' }}>
            {ICON_PLUS} Agregar sede
          </button>
        </div>
      )}
    </section>
  )
}
