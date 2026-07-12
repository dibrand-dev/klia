'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { RegistroAntropometrico, MenuSemanalItem, DistribucionMacros } from '@/types/database'
import RegistroAntropometricoEditSlide from './RegistroAntropometricoEditSlide'
import SlideOverMenuSemanal from './SlideOverMenuSemanal'
import SlideOverMacros from './SlideOverMacros'
import { gramosDesdeMacro } from '@/lib/nutricion/calculos'

const MACRO_DEFS_PREVIEW: { key: 'porcentaje_carbohidratos' | 'porcentaje_proteinas' | 'porcentaje_grasas'; name: string; color: string; kcalPorGramo: 4 | 9 }[] = [
  { key: 'porcentaje_carbohidratos', name: 'Carbohidratos', color: 'var(--macro-cho, var(--accent, #1F4FD9))', kcalPorGramo: 4 },
  { key: 'porcentaje_proteinas', name: 'Proteínas', color: 'var(--macro-prot, var(--violet, #5B3DC9))', kcalPorGramo: 4 },
  { key: 'porcentaje_grasas', name: 'Grasas', color: 'var(--macro-gra, var(--warn, #A65A06))', kcalPorGramo: 9 },
]

const DIAS_CORTO = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function mondayOf(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

type Rango = '3m' | '6m' | '1a' | 'todo'

const RANGO_LABELS: Record<Rango, string> = {
  '3m': '3 meses',
  '6m': '6 meses',
  '1a': '1 año',
  todo: 'Todo',
}

function fechaDesdeParaRango(rango: Rango): string | null {
  if (rango === 'todo') return null
  const meses = rango === '3m' ? 3 : rango === '6m' ? 6 : 12
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

const PAGE_SIZE = 10

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #E7E9EE)',
  borderRadius: 'var(--r-lg, 12px)',
  padding: 20,
}

export default function TabComposicionCorporal({ pacienteId }: { pacienteId: string }) {
  const router = useRouter()
  const [rango, setRango] = useState<Rango>('6m')
  const [registros, setRegistros] = useState<RegistroAntropometrico[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [editando, setEditando] = useState<RegistroAntropometrico | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [macrosOpen, setMacrosOpen] = useState(false)
  const [diasConMenu, setDiasConMenu] = useState<Set<string>>(new Set())
  const [macrosPreview, setMacrosPreview] = useState<DistribucionMacros | null>(null)
  const [loadingWidgets, setLoadingWidgets] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function fetchWidgets() {
      setLoadingWidgets(true)
      const supabase = createClient()
      const semanaActual = mondayOf(new Date()).toISOString().slice(0, 10)
      const [{ data: menuRows }, { data: macros }] = await Promise.all([
        supabase.from('menu_semanal').select('dia').eq('paciente_id', pacienteId).eq('semana_inicio', semanaActual),
        supabase.from('distribucion_macros').select('*').eq('paciente_id', pacienteId).maybeSingle(),
      ])
      if (cancelado) return
      setDiasConMenu(new Set(((menuRows as MenuSemanalItem[]) ?? []).map((r) => r.dia)))
      setMacrosPreview((macros as DistribucionMacros) ?? null)
      setLoadingWidgets(false)
    }
    fetchWidgets()
    return () => { cancelado = true }
  }, [pacienteId, menuOpen, macrosOpen])

  useEffect(() => {
    let cancelado = false
    async function fetchRegistros() {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('registros_antropometricos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false })
      const desde = fechaDesdeParaRango(rango)
      if (desde) query = query.gte('fecha', desde)
      const { data } = await query
      if (cancelado) return
      setRegistros((data ?? []) as RegistroAntropometrico[])
      setPage(0)
      setLoading(false)
    }
    fetchRegistros()
    return () => { cancelado = true }
  }, [pacienteId, rango])

  const chartData = useMemo(() => {
    return [...registros]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((r) => ({
        fecha: new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        porcentaje_grasa: r.porcentaje_grasa,
        porcentaje_musculo: r.porcentaje_musculo,
        peso: r.peso,
      }))
  }, [registros])

  const totalPages = Math.max(1, Math.ceil(registros.length / PAGE_SIZE))
  const registrosPagina = registros.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header + selector de rango */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-on-surface">Composición Corporal y Nutrición</h2>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, #F6F7F9)', borderRadius: 999, padding: 3 }}>
          {(Object.keys(RANGO_LABELS) as Rango[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRango(r)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: rango === r ? 'var(--surface, #fff)' : 'transparent',
                color: rango === r ? 'var(--ink, #0B1220)' : 'var(--muted, #8A93A1)',
                boxShadow: rango === r ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              }}
            >
              {RANGO_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={cardStyle}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando...</p>
        ) : registros.length < 2 ? (
          <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)' }}>
            Todavía no hay suficientes registros para ver la evolución. Se necesitan al menos 2 consultas con datos antropométricos cargados.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #E7E9EE)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: 'var(--muted, #8A93A1)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted, #8A93A1)' }} />
              <Tooltip
                formatter={(value, name) => {
                  const label = name === 'porcentaje_grasa' ? '% Grasa' : name === 'porcentaje_musculo' ? '% Músculo' : 'Peso (kg)'
                  return [value, label] as [typeof value, string]
                }}
              />
              <Legend
                verticalAlign="top"
                formatter={(value) => value === 'porcentaje_grasa' ? '% Grasa' : value === 'porcentaje_musculo' ? '% Músculo' : value}
              />
              <Line type="monotone" dataKey="porcentaje_grasa" stroke="var(--warn, #D97706)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="porcentaje_musculo" stroke="var(--blue, #3B6FD6)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabla evolutiva */}
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #E7E9EE)', textAlign: 'left' }}>
                {['Fecha', 'Peso', 'Cintura', 'Cadera', 'Pl. tricipital', 'Pl. subescapular', 'Pl. suprailíaco', 'Perím. brazo', 'Perím. pierna', '% Grasa', '% Músculo'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', color: 'var(--muted, #5B6472)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosPagina.length === 0 && !loading && (
                <tr><td colSpan={11} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted, #8A93A1)' }}>Sin registros en este período.</td></tr>
              )}
              {registrosPagina.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setEditando(r)}
                  style={{ borderBottom: '1px solid var(--border, #E7E9EE)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                  <td style={{ padding: '8px 10px' }}>{r.peso ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.cintura ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.cadera ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.pliegue_tricipital ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.pliegue_subescapular ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.pliegue_suprailiaco ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.perimetro_brazo ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.perimetro_pierna ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.porcentaje_grasa ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{r.porcentaje_musculo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12, opacity: page === 0 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted, #8A93A1)', alignSelf: 'center' }}>
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12, opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Widgets resumen — Menú Semanal y Distribución de Macros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #0B1220)', marginBottom: 8 }}>Menú Semanal</h3>
          {loadingWidgets ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)', marginBottom: 16 }}>Cargando...</p>
          ) : diasConMenu.size === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)', marginBottom: 16 }}>
              Todavía no hay un menú semanal cargado para esta semana.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {DIAS_NOMBRE.map((dia, i) => (
                  <span
                    key={dia}
                    title={dia}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: diasConMenu.has(dia) ? 'var(--accent-soft, #EAF0FE)' : 'var(--surface-2, #F6F7F9)',
                      color: diasConMenu.has(dia) ? 'var(--accent, #1F4FD9)' : 'var(--muted-3, #AEB5C0)',
                    }}
                  >
                    {DIAS_CORTO[i]}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)', marginBottom: 16 }}>
                {diasConMenu.size} de 7 días con comidas cargadas esta semana.
              </p>
            </>
          )}
          <button type="button" className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setMenuOpen(true)}>
            Editar menú semanal
          </button>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #0B1220)', marginBottom: 8 }}>Distribución de Macronutrientes</h3>
          {loadingWidgets ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)', marginBottom: 16 }}>Cargando...</p>
          ) : !macrosPreview ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)', marginBottom: 16 }}>
              Todavía no hay una distribución de macros configurada.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                {MACRO_DEFS_PREVIEW.map((m) => (
                  <span key={m.key} style={{ width: `${Number(macrosPreview[m.key])}%`, background: m.color }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 16 }}>
                {MACRO_DEFS_PREVIEW.map((m) => (
                  <span key={m.key} style={{ fontSize: 12, color: 'var(--muted, #5B6472)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                    {m.name} · {Number(macrosPreview[m.key])}%
                  </span>
                ))}
              </div>
              {macrosPreview.kcal_objetivo != null && (
                <p style={{ fontSize: 12, color: 'var(--muted-2, #8A93A1)', marginTop: -8, marginBottom: 16 }}>
                  {macrosPreview.kcal_objetivo.toLocaleString('es-AR')} kcal/día objetivo
                  {' · '}
                  {MACRO_DEFS_PREVIEW.map((m) => `${gramosDesdeMacro(macrosPreview.kcal_objetivo, Number(macrosPreview[m.key]), m.kcalPorGramo)}g`).join(' / ')}
                </p>
              )}
            </>
          )}
          <button type="button" className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setMacrosOpen(true)}>
            Ajustar macros
          </button>
        </div>
      </div>

      <RegistroAntropometricoEditSlide
        registro={editando}
        open={!!editando}
        onClose={() => setEditando(null)}
      />

      <SlideOverMenuSemanal
        pacienteId={pacienteId}
        open={menuOpen}
        onClose={() => { setMenuOpen(false); router.refresh() }}
      />
      <SlideOverMacros
        pacienteId={pacienteId}
        open={macrosOpen}
        onClose={() => { setMacrosOpen(false); router.refresh() }}
      />
    </div>
  )
}
