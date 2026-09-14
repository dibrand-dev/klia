'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import type { Paciente, PlanAlimentario } from '@/types/database'
import PlanComidaBlock, { type ComidaConItems } from './PlanComidaBlock'
import SlideOverNuevoPlan from './SlideOverNuevoPlan'
import { buscarAlimentosPorIds, type AlimentoVademecum } from '@/lib/hooks/useVademecumAlimentos'

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

const DIAS_VALUE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type PlanConComidas = PlanAlimentario & { plan_comidas: ComidaConItems[] }

type MacrosPorDia = { diaSemana: string; totales: Record<'energia' | 'proteinas' | 'grasas' | 'carbohidratos', number> }
type MacrosResponse = {
  porDia: { comidaId: string; diaSemana: string; totales: Record<string, number> }[]
  porDiaAgregado: MacrosPorDia[]
  promedioPlan: { diasConDatos: number; totales: Record<string, number> }
}

const MACRO_DEFS: { key: 'carbohidratos' | 'proteinas' | 'grasas'; nombre: string; color: string }[] = [
  { key: 'carbohidratos', nombre: 'Carbohidratos', color: 'var(--accent, #1F4FD9)' },
  { key: 'proteinas', nombre: 'Proteínas', color: 'var(--violet, #5B3DC9)' },
  { key: 'grasas', nombre: 'Grasas', color: 'var(--warn, #A65A06)' },
]

const ICON_PLUS = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>
const ICON_COPY = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
const ICON_CHEV = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--muted-2, #8A93A1)', strokeWidth: 2, fill: 'none', flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
const ICON_ARCHIVE = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12h14V8M10 12h4" /></svg>
const ICON_UNARCHIVE = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 20V9M8 13l4-4 4 4" /><rect x="3" y="3" width="18" height="4" rx="1" /></svg>
const ICON_CLOCK = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--muted, #5B6472)', strokeWidth: 1.9, fill: 'none', flexShrink: 0 }}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
const ICON_WARN = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--warn, #A65A06)', strokeWidth: 1.9, fill: 'none', flexShrink: 0 }}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12h14V8M10 12h4" /></svg>

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function PlanAlimentarioTab({ paciente }: { paciente: Paciente }) {
  const [planes, setPlanes] = useState<PlanAlimentario[]>([])
  const [planActivo, setPlanActivo] = useState<PlanConComidas | null>(null)
  const [macros, setMacros] = useState<MacrosResponse | null>(null)
  const [macrosPorAlimento, setMacrosPorAlimento] = useState<Map<string, AlimentoVademecum>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dayIdx, setDayIdx] = useState(0)
  const [scope, setScope] = useState<'day' | 'plan'>('day')
  const [soOpen, setSoOpen] = useState(false)
  const [planPopOpen, setPlanPopOpen] = useState(false)
  const [showArch, setShowArch] = useState(false)
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function toast(msg: string) {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }

  useEffect(() => {
    if (!planPopOpen) return
    function onDocClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPlanPopOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [planPopOpen])

  const cargarPlanes = useCallback(async () => {
    const res = await fetch(`/api/planes-alimentarios?paciente_id=${paciente.id}`)
    const data = await jsonOrNull(res)
    return (data?.planes ?? []) as PlanAlimentario[]
  }, [paciente.id])

  const cargarPlanActivo = useCallback(async (planId: string) => {
    const [resPlan, resMacros] = await Promise.all([
      fetch(`/api/planes-alimentarios/${planId}`),
      fetch(`/api/planes-alimentarios/${planId}/macros`),
    ])
    const dataPlan = await jsonOrNull(resPlan)
    const dataMacros = await jsonOrNull(resMacros)
    const plan = dataPlan?.plan as PlanConComidas | undefined
    if (plan) {
      const ids = new Set<string>()
      for (const c of plan.plan_comidas ?? []) {
        for (const it of c.plan_comida_items ?? []) {
          if (it.tipo === 'alimento' && it.alimento_id) ids.add(String(it.alimento_id))
        }
      }
      if (ids.size > 0) {
        const mapa = await buscarAlimentosPorIds(Array.from(ids))
        setMacrosPorAlimento((prev) => {
          const next = new Map(prev)
          mapa.forEach((valor, clave) => next.set(clave, valor))
          return next
        })
      }
      setPlanActivo(plan)
    }
    if (dataMacros && !dataMacros.error) setMacros(dataMacros as MacrosResponse)
  }, [])

  const refetch = useCallback(async () => {
    if (!planActivo) return
    await cargarPlanActivo(planActivo.id)
  }, [planActivo, cargarPlanActivo])

  useEffect(() => {
    let cancelado = false
    async function init() {
      setLoading(true)
      const lista = await cargarPlanes()
      if (cancelado) return
      setPlanes(lista)
      if (lista.length > 0) {
        await cargarPlanActivo(lista[0].id)
      }
      if (!cancelado) setLoading(false)
    }
    init()
    return () => { cancelado = true }
  }, [cargarPlanes, cargarPlanActivo])

  // Al cambiar de plan (selección desde el popover, "Ir al vigente", o alta de
  // uno nuevo), arrancar en el primer día con comidas cargadas — igual que el
  // prototipo (selectPlan / dayIdx = plan.findIndex(d => d.length)).
  useEffect(() => {
    if (!planActivo) return
    const idx = DIAS_VALUE.findIndex((d) => planActivo.plan_comidas.some((c) => c.dia_semana === d))
    setDayIdx(idx >= 0 ? idx : 0)
    setScope('day')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planActivo?.id])

  function registrarAlimento(a: AlimentoVademecum) {
    setMacrosPorAlimento((prev) => {
      const next = new Map(prev)
      next.set(String(a.id), a)
      return next
    })
  }

  async function onPlanCreado(planId: string) {
    setSoOpen(false)
    const lista = await cargarPlanes()
    setPlanes(lista)
    await cargarPlanActivo(planId)
    toast('Plan creado. El anterior quedó como plan anterior.')
  }

  async function seleccionarPlan(planId: string) {
    setPlanPopOpen(false)
    await cargarPlanActivo(planId)
  }

  async function irAlVigente() {
    const activo = planes.find((p) => p.estado === 'activo')
    if (activo) await seleccionarPlan(activo.id)
  }

  async function cambiarEstadoPlan(planId: string, accion: 'activar' | 'archivar' | 'desarchivar') {
    const res = await fetch(`/api/planes-alimentarios/${planId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    })
    const data = await jsonOrNull(res)
    if (!res.ok || data?.error) {
      return { error: data?.error ?? 'Error al cambiar el estado del plan' as string }
    }
    const lista = await cargarPlanes()
    setPlanes(lista)
    if (planActivo?.id === planId) await cargarPlanActivo(planId)
    return { error: null }
  }

  async function onArchivar(p: PlanAlimentario) {
    const { error } = await cambiarEstadoPlan(p.id, 'archivar')
    if (error) { toast(error); return }
    setShowArch(true)
    toast(`«${p.nombre}» archivado. Podés recuperarlo cuando quieras.`)
    if (p.id === planActivo?.id) {
      const activo = planes.find((x) => x.estado === 'activo' && x.id !== p.id)
      if (activo) await seleccionarPlan(activo.id)
    }
  }

  async function onDesarchivar(p: PlanAlimentario) {
    await cambiarEstadoPlan(p.id, 'desarchivar')
  }

  async function onActivar(p: PlanAlimentario) {
    const { error } = await cambiarEstadoPlan(p.id, 'activar')
    if (error) { toast(error); return }
    setUnlockedIds((prev) => { const next = new Set(prev); next.delete(p.id); return next })
    toast(`«${p.nombre}» es ahora el plan vigente.`)
  }

  function onDesbloquear(p: PlanAlimentario) {
    setUnlockedIds((prev) => new Set(prev).add(p.id))
    toast('Edición habilitada sobre un plan anterior.')
  }

  async function agregarPrimeraComida() {
    if (!planActivo) return
    const dia = DIAS_VALUE[dayIdx]
    const res = await fetch(`/api/planes-alimentarios/${planActivo.id}/comidas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia_semana: dia, tipo_comida: 'Desayuno', hora: '08:00', orden: 0 }),
    })
    const data = await jsonOrNull(res)
    const comidaId = data?.comida?.id
    if (comidaId) {
      await fetch(`/api/plan-comidas/${comidaId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          planActivo.modo === 'simple'
            ? { tipo: 'texto_libre', contenido_texto: '' }
            : { tipo: 'alimento', alimento_fuente: 'argenfood', alimento_id: null, cantidad_gramos: 100 }
        ),
      })
    }
    refetch()
  }

  async function agregarComida() {
    if (!planActivo) return
    const dia = DIAS_VALUE[dayIdx]
    const comidasDelDia = planActivo.plan_comidas.filter((c) => c.dia_semana === dia)
    const nombres = ['Desayuno', 'Colación', 'Almuerzo', 'Merienda', 'Cena']
    const horas = ['08:00', '10:30', '13:00', '17:30', '21:00']
    const n = Math.min(comidasDelDia.length, 4)
    await fetch(`/api/planes-alimentarios/${planActivo.id}/comidas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia_semana: dia, tipo_comida: nombres[n], hora: horas[n], orden: comidasDelDia.length }),
    })
    refetch()
  }

  async function copiarDeOtroDia() {
    if (!planActivo) return
    const diaActual = DIAS_VALUE[dayIdx]
    const diaOrigen = DIAS_VALUE.find((d) => d !== diaActual && planActivo.plan_comidas.some((c) => c.dia_semana === d))
    if (!diaOrigen) return
    const comidasOrigen = planActivo.plan_comidas.filter((c) => c.dia_semana === diaOrigen)
    for (const c of comidasOrigen) {
      const res = await fetch(`/api/planes-alimentarios/${planActivo.id}/comidas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dia_semana: diaActual, tipo_comida: c.tipo_comida, hora: c.hora, orden: c.orden }),
      })
      const data = await jsonOrNull(res)
      const nuevaComidaId = data?.comida?.id
      if (!nuevaComidaId) continue
      for (const item of c.plan_comida_items ?? []) {
        await fetch(`/api/plan-comidas/${nuevaComidaId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            item.tipo === 'alimento'
              ? { tipo: 'alimento', alimento_fuente: item.alimento_fuente, alimento_id: item.alimento_id, cantidad_gramos: item.cantidad_gramos }
              : { tipo: 'texto_libre', contenido_texto: item.contenido_texto }
          ),
        })
      }
    }
    refetch()
  }

  if (loading) {
    return <p style={{ padding: 20, fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando...</p>
  }

  const edad = paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) : null

  if (!planActivo) {
    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ background: 'var(--surface, #fff)', border: '1px dashed var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-xl, 16px)', padding: '38px 24px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Todavía no hay un plan alimentario</h3>
          <p style={{ margin: '0 auto 16px', fontSize: 13, color: 'var(--muted, #5B6472)', maxWidth: 360, lineHeight: 1.6 }}>
            Creá el primer plan para {paciente.nombre} {paciente.apellido} y empezá a cargar comidas.
          </p>
          <button type="button" onClick={() => setSoOpen(true)} className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ICON_PLUS}Nuevo plan
          </button>
        </div>
        <SlideOverNuevoPlan
          pacienteId={paciente.id}
          pacienteNombre={`${paciente.nombre} ${paciente.apellido}`}
          open={soOpen}
          onClose={() => setSoOpen(false)}
          onCreado={onPlanCreado}
        />
      </div>
    )
  }

  const diaActualValue = DIAS_VALUE[dayIdx]
  const comidasDelDia = planActivo.plan_comidas
    .filter((c) => c.dia_semana === diaActualValue)
    .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.orden - b.orden)

  const diasConComidas = new Set(planActivo.plan_comidas.map((c) => c.dia_semana))
  const diasSemanaParaPopover = DIAS_VALUE.map((v, i) => ({ value: v, label: DIAS_LABEL[i], tieneComidas: diasConComidas.has(v) }))

  const macrosPorDiaMap = new Map((macros?.porDiaAgregado ?? []).map((d) => [d.diaSemana, d.totales]))

  const ro = planActivo.estado !== 'activo' && !unlockedIds.has(planActivo.id)
  const visibles = planes.filter((p) => p.estado !== 'archivado')
  const idxVisible = visibles.findIndex((p) => p.id === planActivo.id)
  const contadorPlan = idxVisible < 0 ? 'archivado' : `${idxVisible + 1} de ${visibles.length}`
  const activos = planes.filter((p) => p.estado === 'activo')
  const pasados = planes.filter((p) => p.estado === 'pasado')
  const archivados = planes.filter((p) => p.estado === 'archivado')

  return (
    <div style={{ padding: '4px 0 40px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div ref={popRef} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <button
              type="button"
              onClick={() => setPlanPopOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, border: '1px solid transparent', background: 'transparent',
                borderRadius: 'var(--r-md, 8px)', padding: '3px 8px', margin: '-3px -8px', cursor: 'pointer', font: 'inherit',
                textAlign: 'left', maxWidth: '100%',
              }}
            >
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink, #0B1220)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{planActivo.nombre}</h1>
              {planes.length > 1 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', background: 'var(--surface-3, #F1F3F6)', borderRadius: 100, padding: '2px 7px', flexShrink: 0 }}>{contadorPlan}</span>
              )}
              {ICON_CHEV}
            </button>

            {planPopOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 352, maxWidth: 'calc(100vw - 40px)', background: 'var(--surface, #fff)', border: '1px solid var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(16,24,40,.08))', zIndex: 30, padding: 7 }}>
                {activos.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)', padding: '9px 8px 4px' }}>Plan vigente</div>
                    {activos.map((p) => <PlanRow key={p.id} p={p} sel={p.id === planActivo.id} onSelect={seleccionarPlan} onArchivar={onArchivar} onDesarchivar={onDesarchivar} />)}
                  </>
                )}
                {pasados.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)', padding: '9px 8px 4px' }}>Planes anteriores</div>
                    {pasados.map((p) => <PlanRow key={p.id} p={p} sel={p.id === planActivo.id} onSelect={seleccionarPlan} onArchivar={onArchivar} onDesarchivar={onDesarchivar} />)}
                  </>
                )}
                {showArch && archivados.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)', padding: '9px 8px 4px' }}>Archivados</div>
                    {archivados.map((p) => <PlanRow key={p.id} p={p} sel={p.id === planActivo.id} onSelect={seleccionarPlan} onArchivar={onArchivar} onDesarchivar={onDesarchivar} />)}
                  </>
                )}
                <div style={{ borderTop: '1px solid var(--border, #E7E9EE)', marginTop: 6, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {archivados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowArch((v) => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 500, color: 'var(--muted, #5B6472)', padding: '8px 9px', borderRadius: 'var(--r-md, 8px)', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {ICON_ARCHIVE}{showArch ? 'Ocultar archivados' : 'Ver archivados'}
                      <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--muted-3, #AEB5C0)' }}>{archivados.length}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setPlanPopOpen(false); setSoOpen(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink, #1F4FD9)', padding: '8px 9px', borderRadius: 'var(--r-md, 8px)', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {ICON_PLUS}Nuevo plan alimentario
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5, fontSize: 12.5, color: 'var(--muted, #5B6472)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: 'var(--accent-soft, #EAF0FE)', color: 'var(--accent-ink, #1F4FD9)' }}>
              {planActivo.modo === 'simple' ? 'Simple' : 'Fórmula desarrollada'}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-3, #AEB5C0)' }} />
            <span>{paciente.nombre} {paciente.apellido}{edad != null ? ` · ${edad} años` : ''}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-3, #AEB5C0)' }} />
            <span>{diasConComidas.size} de 7 días cargados</span>
          </div>
        </div>
        {!ro && (
          <button type="button" onClick={() => setSoOpen(true)} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ICON_PLUS}Nuevo plan
          </button>
        )}
      </div>

      {ro && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', padding: '11px 14px', borderRadius: 'var(--r-lg, 12px)',
          border: planActivo.estado === 'archivado' ? '1px solid transparent' : '1px solid var(--border, #E7E9EE)',
          background: planActivo.estado === 'archivado' ? 'var(--warn-soft, #FEF3E2)' : 'var(--surface-2, #F6F7F9)', marginBottom: 14,
        }}>
          {planActivo.estado === 'archivado' ? ICON_WARN : ICON_CLOCK}
          <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: planActivo.estado === 'archivado' ? '#7A4405' : 'var(--muted, #5B6472)', lineHeight: 1.5 }}>
            {planActivo.estado === 'archivado' ? (
              <><b style={{ color: '#7A4405', fontWeight: 600 }}>Plan archivado</b> · {fmtFecha(planActivo.created_at)}. No aparece en la ficha del paciente y no se puede editar.</>
            ) : (
              <><b style={{ color: 'var(--ink-2, #1F2937)', fontWeight: 600 }}>Plan anterior · solo lectura</b> — creado el {fmtFecha(planActivo.created_at)}, {diasConComidas.size} {diasConComidas.size === 1 ? 'día cargado' : 'días cargados'}. Se conserva como registro del tratamiento.</>
            )}
          </span>
          <span style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {planActivo.estado === 'archivado' ? (
              <button type="button" onClick={() => onDesarchivar(planActivo)} className="btn" style={{ padding: '5px 11px', fontSize: 12.5 }}>Desarchivar</button>
            ) : (
              <>
                <button type="button" onClick={() => onDesbloquear(planActivo)} className="btn" style={{ padding: '5px 11px', fontSize: 12.5 }}>Editar de todos modos</button>
                <button type="button" onClick={() => onActivar(planActivo)} className="btn" style={{ padding: '5px 11px', fontSize: 12.5 }}>Marcar como vigente</button>
              </>
            )}
            {activos.length > 0 && <button type="button" onClick={irAlVigente} className="btn" style={{ padding: '5px 11px', fontSize: 12.5 }}>Ir al vigente</button>}
          </span>
        </div>
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: '#0B1220', color: '#fff', fontSize: 12.5, padding: '9px 15px', borderRadius: 100, boxShadow: '0 14px 34px rgba(11,18,32,.3)', zIndex: 70, maxWidth: '86vw', textAlign: 'center' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 304px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '3px 3px 9px', margin: '0 -3px 14px' }}>
            {DIAS_LABEL.map((_, i) => {
              const dia = DIAS_VALUE[i]
              const has = diasConComidas.has(dia)
              const totalesDia = macrosPorDiaMap.get(dia)
              const kcal = totalesDia ? Math.round(totalesDia.energia) : null
              const k = planActivo.modo === 'simple'
                ? (has ? `${planActivo.plan_comidas.filter((c) => c.dia_semana === dia).length} comidas` : 'sin cargar')
                : (has ? (kcal != null ? `${kcal.toLocaleString('es-AR')} kcal` : '—') : 'sin cargar')
              const sel = i === dayIdx
              return (
                <button
                  key={dia}
                  onClick={() => setDayIdx(i)}
                  style={{
                    flexShrink: 0, minWidth: 92, background: sel ? 'var(--ink, #0B1220)' : 'var(--surface, #fff)',
                    border: `1px solid ${sel ? 'var(--ink, #0B1220)' : 'var(--border, #E7E9EE)'}`, borderRadius: 'var(--r-lg, 12px)',
                    padding: '8px 12px 9px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: sel ? '#fff' : 'var(--ink-2, #1F2937)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i style={{ width: 5, height: 5, borderRadius: '50%', background: has ? (sel ? '#6EE7B7' : 'var(--ok, #10B981)') : (sel ? 'rgba(255,255,255,.4)' : 'var(--muted-3, #AEB5C0)') }} />
                    {DIAS_CORTO[i]}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: sel ? 'rgba(255,255,255,.6)' : 'var(--muted-2, #8A93A1)' }}>{k}</span>
                </button>
              )
            })}
          </div>

          {comidasDelDia.length === 0 ? (
            <div style={{ background: 'var(--surface, #fff)', border: '1px dashed var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-xl, 16px)', padding: '38px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>{DIAS_LABEL[dayIdx]} todavía no tiene comidas</h3>
              <p style={{ margin: '0 auto 16px', fontSize: 13, color: 'var(--muted, #5B6472)', maxWidth: 360, lineHeight: 1.6 }}>
                {ro ? `Este plan no tenía comidas cargadas para ${DIAS_LABEL[dayIdx].toLowerCase()}.` : 'Agregá la primera comida del día, o copiá un día que ya tengas armado para no empezar de cero.'}
              </p>
              {!ro && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={agregarPrimeraComida} className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {ICON_PLUS}Agregar primera comida
                  </button>
                  {diasConComidas.size > 0 && (
                    <button type="button" onClick={copiarDeOtroDia} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {ICON_COPY}Copiar de otro día
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comidasDelDia.map((comida) => (
                  <PlanComidaBlock
                    key={comida.id}
                    comida={comida}
                    modo={planActivo.modo === 'simple' ? 'simple' : 'formula'}
                    diasSemana={diasSemanaParaPopover}
                    diaActual={diaActualValue}
                    macrosPorAlimento={macrosPorAlimento}
                    onRegistrarAlimento={registrarAlimento}
                    onChanged={refetch}
                    readOnly={ro}
                  />
                ))}
              </div>
              {!ro && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" onClick={agregarComida} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, border: '1px dashed var(--border-strong, #D6DAE1)', background: 'transparent', fontSize: 12.5, fontWeight: 500, color: 'var(--muted, #5B6472)', cursor: 'pointer' }}>
                    {ICON_PLUS}Agregar comida
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 78 }}>
          <MacrosCard
            planModo={planActivo.modo}
            scope={scope}
            onScope={setScope}
            diaLabel={DIAS_LABEL[dayIdx]}
            comidasDelDia={comidasDelDia.length}
            totalesDia={macrosPorDiaMap.get(diaActualValue) ?? null}
            promedioPlan={macros?.promedioPlan ?? null}
          />
          <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,.04))', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #0B1220)', marginBottom: 12 }}>Kcal por comida</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {comidasDelDia.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>Sin comidas en {DIAS_LABEL[dayIdx]}.</p>
              ) : comidasDelDia.map((c) => {
                const porComida = macros?.porDia.find((p) => p.comidaId === c.id)
                const kcal = porComida ? Math.round(porComida.totales.energia) : 0
                const val = planActivo.modo === 'simple' ? `${c.plan_comida_items.length} ítems` : (kcal > 0 ? `${kcal.toLocaleString('es-AR')} kcal` : 'sin calcular')
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, color: 'var(--muted, #5B6472)' }}>
                    <b style={{ color: 'var(--ink-2, #1F2937)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.tipo_comida}</b>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', flexShrink: 0 }}>{val}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <SlideOverNuevoPlan
        pacienteId={paciente.id}
        pacienteNombre={`${paciente.nombre} ${paciente.apellido}`}
        open={soOpen}
        onClose={() => setSoOpen(false)}
        onCreado={onPlanCreado}
      />
    </div>
  )
}

function PlanRow({
  p, sel, onSelect, onArchivar, onDesarchivar,
}: {
  p: PlanAlimentario
  sel: boolean
  onSelect: (id: string) => void
  onArchivar: (p: PlanAlimentario) => void
  onDesarchivar: (p: PlanAlimentario) => void
}) {
  const archivado = p.estado === 'archivado'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 'var(--r-md, 8px)', paddingRight: 4, background: sel ? 'var(--accent-soft, #EAF0FE)' : 'transparent' }}
      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent' }}
    >
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', font: 'inherit', textAlign: 'left', padding: '8px 6px 8px 9px', cursor: 'pointer', borderRadius: 'var(--r-md, 8px)' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 13.5, fontWeight: archivado ? 500 : 600, color: archivado ? 'var(--muted, #5B6472)' : 'var(--ink, #0B1220)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</b>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginTop: 1 }}>{fmtFecha(p.created_at)} · {p.modo === 'simple' ? 'Simple' : 'Fórmula desarrollada'}</span>
        </span>
        {p.estado === 'activo' && (
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 100, background: 'var(--ok-soft, #DFF3E8)', color: 'var(--ok-ink, #17663F)' }}>Vigente</span>
        )}
        {archivado && (
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 100, background: 'var(--surface-3, #F1F3F6)', color: 'var(--muted, #5B6472)' }}>Archivado</span>
        )}
      </button>
      <button
        type="button"
        title={archivado ? 'Desarchivar' : 'Archivar plan'}
        onClick={() => archivado ? onDesarchivar(p) : onArchivar(p)}
        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--muted, #5B6472)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-3, #F1F3F6)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {archivado ? ICON_UNARCHIVE : ICON_ARCHIVE}
      </button>
    </div>
  )
}

function MacrosCard({
  planModo, scope, onScope, diaLabel, comidasDelDia, totalesDia, promedioPlan,
}: {
  planModo: string
  scope: 'day' | 'plan'
  onScope: (s: 'day' | 'plan') => void
  diaLabel: string
  comidasDelDia: number
  totalesDia: Record<string, number> | null
  promedioPlan: { diasConDatos: number; totales: Record<string, number> } | null
}) {
  const esSimple = planModo === 'simple'
  const totales = scope === 'day' ? totalesDia : (promedioPlan?.totales ?? null)
  const kcal = totales ? Math.round(totales.energia) : 0
  const kcalFromMacros = totales ? MACRO_DEFS.reduce((s, m) => s + (totales[m.key] ?? 0) * (m.key === 'grasas' ? 9 : 4), 0) : 0
  // s/d (sin dato) solo cuando NINGÚN ítem que aporta al scope tiene dato real
  // para esa macro puntual — si al menos uno sí lo tiene, se muestra la suma.
  const kcalSinDato = totales ? (totales.energia === 0 && (totales.energiaSinDato ?? 0) > 0) : false

  return (
    <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,.04))', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #0B1220)', flex: 1 }}>Macronutrientes</span>
        <div style={{ display: 'flex', padding: 2, background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 7, gap: 2 }}>
          {(['day', 'plan'] as const).map((s) => (
            <button key={s} onClick={() => onScope(s)} style={{ border: 'none', background: scope === s ? 'var(--ink, #0B1220)' : 'transparent', padding: '4px 9px', fontSize: 11.5, fontWeight: 600, color: scope === s ? '#fff' : 'var(--muted, #5B6472)', borderRadius: 5, cursor: 'pointer' }}>
              {s === 'day' ? 'Día' : 'Plan'}
            </button>
          ))}
        </div>
      </div>

      {esSimple ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
            <b style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ink, #0B1220)' }}>—</b>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginBottom: 14 }}>El modo Simple no calcula macros: los ítems son texto libre.</p>
          <p style={{ fontSize: 11, color: 'var(--muted-3, #AEB5C0)', lineHeight: 1.5 }}>Para ver energía y macros calculados, cambiá el plan a modo <b>Fórmula desarrollada</b>.</p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
            {kcalSinDato ? (
              <b style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--muted-3, #AEB5C0)' }}>s/d</b>
            ) : (
              <>
                <b style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ink, #0B1220)' }}>{kcal.toLocaleString('es-AR')}</b>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-2, #8A93A1)' }}>kcal</span>
              </>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginBottom: 14 }}>
            {scope === 'day' ? `${diaLabel} · ${comidasDelDia} comidas` : `Promedio de ${promedioPlan?.diasConDatos ?? 0} ${(promedioPlan?.diasConDatos ?? 0) === 1 ? 'día cargado' : 'días cargados'}`}
          </p>
          <div style={{ display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden', background: 'var(--surface-3, #F1F3F6)', marginBottom: 12 }}>
            {kcalFromMacros > 0 && totales && MACRO_DEFS.map((m) => {
              const kpg = m.key === 'grasas' ? 9 : 4
              const pct = ((totales[m.key] ?? 0) * kpg / kcalFromMacros) * 100
              return <span key={m.key} style={{ width: `${pct}%`, background: m.color }} />
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {MACRO_DEFS.map((m, i) => {
              const g = totales ? (totales[m.key] ?? 0) : 0
              const sinDatoKey = `${m.key}SinDato`
              const sinDato = totales ? (g === 0 && (totales[sinDatoKey] ?? 0) > 0) : false
              const kpg = m.key === 'grasas' ? 9 : 4
              const pct = kcalFromMacros > 0 ? ((g * kpg) / kcalFromMacros) * 100 : null
              return (
                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '9px 1fr auto auto', gap: 9, alignItems: 'center', padding: '8px 0', borderBottom: i < MACRO_DEFS.length - 1 ? '1px solid var(--surface-3, #F1F3F6)' : 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color }} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2, #1F2937)' }}>{m.nombre}</span>
                  {sinDato ? (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--muted-3, #AEB5C0)', minWidth: 52, textAlign: 'right' }}>s/d</span>
                  ) : (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--ink, #0B1220)', minWidth: 52, textAlign: 'right' }}>{Math.round(g)} g</span>
                  )}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted-2, #8A93A1)', minWidth: 34, textAlign: 'right' }}>{sinDato || pct == null ? '—' : `${Math.round(pct)}%`}</span>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-3, #AEB5C0)', lineHeight: 1.5, marginTop: 10 }}>Carbohidratos y proteínas 4 kcal/g · grasas 9 kcal/g.</p>
        </>
      )}
    </div>
  )
}
