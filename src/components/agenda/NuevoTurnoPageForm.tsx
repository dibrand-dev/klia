'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Paciente, Turno, ModalidadTurno, Entrevista } from '@/types/database'
import type { ConflictoDetallado } from '@/lib/recurrentes'
import { DIAS_SEMANA } from '@/lib/recurrentes'
import MontoInput from '@/components/ui/MontoInput'
import MonedaSelector from '@/components/ui/MonedaSelector'
import PacienteSearchInput from './PacienteSearchInput'
import ConflictosPanel from './ConflictosPanel'
import type { Moneda } from '@/lib/monedas'

const DURACIONES = [30, 45, 50, 60, 90]
const MODALIDADES: { value: ModalidadTurno; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'telefonica', label: 'Telefónica' },
]

interface NuevoTurnoPageFormProps {
  pacientes: Paciente[]
  terapeutaId: string
  fechaInicial?: Date
  pacienteIdInicial?: string
  onCreado?: (turno: Turno) => void
  onEntrevistaCreada?: (e: Entrevista) => void
  onClose?: () => void
}

function diaDeFecha(fechaStr: string): number {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// Retorna en qué N-ésima semana del mes cae la fecha (1-4)
function nesimaOcurrencia(fechaStr: string): number {
  return Math.min(4, Math.ceil(new Date(fechaStr + 'T12:00:00').getDate() / 7))
}

// Para quincenal: si la fecha cae en semana 1 ó 3 → devuelve 1; si 2 ó 4 → devuelve 2
function quinSemana(fechaStr: string): 1 | 2 {
  const n = nesimaOcurrencia(fechaStr)
  return (n === 1 || n === 3) ? 1 : 2
}

export default function NuevoTurnoPageForm({
  pacientes, terapeutaId, fechaInicial, pacienteIdInicial, onCreado, onEntrevistaCreada, onClose,
}: NuevoTurnoPageFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fechaParam = fechaInicial
    ? format(fechaInicial, 'yyyy-MM-dd')
    : (searchParams.get('fecha') ?? format(new Date(), 'yyyy-MM-dd'))
  const horaParam = fechaInicial
    ? format(fechaInicial, 'HH:mm')
    : (searchParams.get('hora') ?? '09:00')

  const [tipo, setTipo] = useState<'sesion' | 'entrevista'>('sesion')
  const [entrevistaForm, setEntrevistaForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    fecha: fechaParam,
    hora: horaParam,
    duracion: 50,
    costo: '',
    notas: '',
  })

  const [form, setForm] = useState({
    paciente_id: pacienteIdInicial ?? '',
    fecha: fechaParam,
    hora: horaParam,
    duracion_min: 50,
    modalidad: 'presencial' as ModalidadTurno,
    monto: '',
    notas: '',
  })
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const [esFijo, setEsFijo] = useState(false)
  const [frecuencia, setFrecuencia] = useState<'semanal' | 'quincenal' | 'mensual'>('semanal')
  const [diaSemana, setDiaSemana] = useState(diaDeFecha(fechaParam))
  const [semanaDelMes, setSemanaDelMes] = useState<number>(nesimaOcurrencia(fechaParam))
  const [fechaFin, setFechaFin] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictos, setConflictos] = useState<ConflictoDetallado[]>([])
  const [fechasValidas, setFechasValidas] = useState<Date[]>([])
  const [mostrandoConflictos, setMostrandoConflictos] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'fecha') {
      setDiaSemana(diaDeFecha(value))
      setSemanaDelMes(nesimaOcurrencia(value))
    }
  }

  async function doCrearSerie(fechas: Date[]) {
    const supabase = createClient()
    const { crearRegistroSerie, crearSerieTurnos } = await import('@/lib/recurrentes')
    const [y, m, d] = form.fecha.split('-').map(Number)
    const [yf, mf, df] = fechaFin.split('-').map(Number)
    const semana = frecuencia !== 'semanal' ? semanaDelMes : undefined
    const serieId = await crearRegistroSerie(
      terapeutaId, form.paciente_id, diaSemana, form.hora,
      Number(form.duracion_min), form.modalidad, form.monto ? Number(form.monto) : null,
      new Date(y, m - 1, d), new Date(yf, mf - 1, df), supabase, frecuencia, semana
    )
    await crearSerieTurnos(serieId, terapeutaId, form.paciente_id, fechas,
      form.hora, Number(form.duracion_min), form.modalidad, form.monto ? Number(form.monto) : null, supabase, moneda)
    fetch('/api/google-calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serie_id: serieId, action: 'create' }),
    }).catch(() => {})
    if (onClose) {
      router.refresh()
      onClose()
    } else {
      router.push('/agenda')
      router.refresh()
    }
  }

  function handleEntrevistaChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setEntrevistaForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmitEntrevista(e: React.FormEvent) {
    e.preventDefault()
    if (!entrevistaForm.nombre.trim()) { setError('Nombre es requerido'); return }
    if (!entrevistaForm.apellido.trim()) { setError('Apellido es requerido'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: dbError } = await supabase
      .from('entrevistas')
      .insert({
        terapeuta_id: terapeutaId,
        nombre: entrevistaForm.nombre.trim(),
        apellido: entrevistaForm.apellido.trim(),
        telefono: entrevistaForm.telefono.trim() || null,
        email: entrevistaForm.email.trim() || null,
        fecha: entrevistaForm.fecha,
        hora: entrevistaForm.hora,
        duracion: Number(entrevistaForm.duracion),
        costo: entrevistaForm.costo ? Number(entrevistaForm.costo) : null,
        notas: entrevistaForm.notas.trim() || null,
        estado: 'pendiente',
      })
      .select('*')
      .single()

    if (dbError) {
      setError('Error al crear la entrevista. Intentá de nuevo.')
      setLoading(false)
      return
    }

    if (data?.id) {
      fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrevista_id: data.id, action: 'create' }),
      }).catch(() => {})
    }

    if (onEntrevistaCreada && data) {
      onEntrevistaCreada(data)
    } else if (onClose) {
      router.refresh()
      onClose()
    } else {
      router.push('/agenda')
      router.refresh()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id) { setError('Seleccioná un paciente'); return }
    setLoading(true)
    setError(null)

    if (esFijo) {
      try {
        const { generarFechasSerie, detectarConflictosDetallados } = await import('@/lib/recurrentes')
        const [y, m, d] = form.fecha.split('-').map(Number)
        const [yf, mf, df] = fechaFin.split('-').map(Number)
        const supabase = createClient()
        const semana = frecuencia !== 'semanal' ? semanaDelMes : undefined
        const fechas = generarFechasSerie(diaSemana, new Date(y, m - 1, d), new Date(yf, mf - 1, df), frecuencia, semana)
        const conf = await detectarConflictosDetallados(terapeutaId, fechas, form.hora, Number(form.duracion_min), supabase)
        const validas = fechas.filter((f) => !conf.some((c) => c.fecha.getTime() === f.getTime()))

        if (conf.length > 0) {
          setConflictos(conf)
          setFechasValidas(validas)
          setMostrandoConflictos(true)
          setLoading(false)
          return
        }

        await doCrearSerie(fechas)
      } catch (e) {
        console.error('[crear serie]', e)
        setError(e instanceof Error ? e.message : 'Error al crear la serie. Intentá de nuevo.')
        setLoading(false)
      }
      return
    }

    const supabase = createClient()
    const { data, error: dbError } = await supabase
      .from('turnos')
      .insert({
        terapeuta_id: terapeutaId,
        paciente_id: form.paciente_id,
        fecha_hora: new Date(`${form.fecha}T${form.hora}:00`).toISOString(),
        duracion_min: Number(form.duracion_min),
        modalidad: form.modalidad,
        estado: 'pendiente',
        monto: form.monto ? Number(form.monto) : null,
        moneda,
        notas: form.notas || null,
      })
      .select('*, paciente:pacientes(*)')
      .single()

    if (dbError) {
      setError('Error al crear el turno. Intentá de nuevo.')
      setLoading(false)
      return
    }

    if (data?.id) {
      fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: data.id, action: 'create' }),
      }).catch(() => {})
    }
    if (onCreado && data) {
      onCreado(data as unknown as Turno)
    } else {
      router.push('/agenda')
      router.refresh()
    }
  }

  async function handleOmitirConflictos() {
    setLoading(true)
    try {
      await doCrearSerie(fechasValidas)
    } catch (e) {
      console.error('[omitir conflictos]', e)
      setError(e instanceof Error ? e.message : 'Error al crear la serie. Intentá de nuevo.')
      setLoading(false)
    }
  }

  const pacientesActivos = pacientes.filter((p) => p.activo)

  if (tipo === 'entrevista') {
    return (
      <form onSubmit={handleSubmitEntrevista} className="space-y-4">
        {/* Selector tipo */}
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Tipo de turno</p>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="tipo" value="sesion" checked={false}
                onChange={() => setTipo('sesion')} className="accent-primary" />
              <span className="text-sm text-gray-700">Sesión</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="tipo" value="entrevista" checked
                onChange={() => {}} className="accent-primary" />
              <span className="text-sm text-gray-700 font-medium">Entrevista</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="card p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
            <input name="nombre" value={entrevistaForm.nombre} onChange={handleEntrevistaChange}
              required className="input-field" placeholder="Nombre" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido *</label>
            <input name="apellido" value={entrevistaForm.apellido} onChange={handleEntrevistaChange}
              required className="input-field" placeholder="Apellido" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
            <input name="telefono" value={entrevistaForm.telefono} onChange={handleEntrevistaChange}
              className="input-field" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input name="email" type="email" value={entrevistaForm.email}
              onChange={handleEntrevistaChange} className="input-field" placeholder="Opcional" />
          </div>
        </div>

        <div className="card p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha *</label>
            <input type="date" name="fecha" value={entrevistaForm.fecha}
              onChange={handleEntrevistaChange} required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora *</label>
            <input type="time" name="hora" value={entrevistaForm.hora}
              onChange={handleEntrevistaChange} required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duración</label>
            <select name="duracion" value={entrevistaForm.duracion}
              onChange={handleEntrevistaChange} className="input-field">
              {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo (ARS) <span className="text-gray-400 font-normal">opcional</span></label>
            <MontoInput name="costo" value={entrevistaForm.costo}
              onChange={(raw) => setEntrevistaForm((p) => ({ ...p, costo: raw }))}
              className="input-field" />
          </div>
        </div>

        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Notas <span className="text-gray-400 font-normal">opcional</span>
          </label>
          <textarea name="notas" value={entrevistaForm.notas}
            onChange={handleEntrevistaChange} rows={3}
            placeholder="Observaciones..." className="input-field resize-none" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => onClose ? onClose() : router.back()}
            className="btn-secondary flex-1 py-3">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className={cn('btn-primary flex-1 py-3', loading && 'opacity-70')}>
            {loading ? 'Guardando...' : 'Crear entrevista'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Selector tipo */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Tipo de turno</p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo" value="sesion" checked
              onChange={() => {}} className="accent-primary" />
            <span className="text-sm text-gray-700 font-medium">Sesión</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo" value="entrevista" checked={false}
              onChange={() => setTipo('entrevista')} className="accent-primary" />
            <span className="text-sm text-gray-700">Entrevista</span>
          </label>
        </div>
      </div>

      {mostrandoConflictos ? (
        <div className="card p-4">
          <ConflictosPanel
            conflictos={conflictos}
            onOmitir={handleOmitirConflictos}
            onCancelar={() => setMostrandoConflictos(false)}
            loading={loading}
            sinFechasValidas={fechasValidas.length === 0}
          />
        </div>
      ) : (
        <>
          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Paciente *</label>
            <PacienteSearchInput
              pacientes={pacientesActivos}
              value={form.paciente_id}
              onChange={(id) => {
                setForm((prev) => ({ ...prev, paciente_id: id }))
                const p = pacientes.find((p) => p.id === id)
                if (p?.moneda_preferida) setMoneda(p.moneda_preferida as Moneda)
              }}
              className="input-field"
            />
          </div>

          <div className="card p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha *</label>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora *</label>
              <input type="time" name="hora" value={form.hora} onChange={handleChange} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duración</label>
              <select name="duracion_min" value={form.duracion_min} onChange={handleChange} className="input-field">
                {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modalidad</label>
              <select name="modalidad" value={form.modalidad} onChange={handleChange} className="input-field">
                {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Honorarios <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <div className="flex gap-2">
              <MonedaSelector value={moneda} onChange={setMoneda} className="w-40 shrink-0" />
              <MontoInput
                name="monto"
                value={form.monto}
                onChange={(raw) => setForm((prev) => ({ ...prev, monto: raw }))}
                placeholder={moneda === 'ARS' ? 'Ej: 15000' : moneda === 'USD' ? 'Ej: 150.00' : 'Ej: 130.00'}
                className="input-field flex-1"
              />
            </div>
          </div>

          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notas <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <textarea
              name="notas" value={form.notas} onChange={handleChange}
              rows={3} placeholder="Observaciones del turno..."
              className="input-field resize-none"
            />
          </div>

          {/* Toggle turno fijo */}
          <div className="card p-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">¿Es un turno fijo?</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {esFijo ? 'Se crearán turnos recurrentes' : 'Turno único'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEsFijo((v) => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                  esFijo ? 'bg-primary' : 'bg-gray-300'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                  esFijo ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {esFijo && (
              <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-4">
                {/* Frecuencia */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Frecuencia</label>
                  <div className="flex gap-2">
                    {(['semanal', 'quincenal', 'mensual'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setFrecuencia(f)
                          if (f === 'quincenal') setSemanaDelMes(quinSemana(form.fecha))
                          if (f === 'mensual') setSemanaDelMes(nesimaOcurrencia(form.fecha))
                        }}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                          frecuencia === f
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                        )}
                      >
                        {f === 'semanal' ? 'Semanal' : f === 'quincenal' ? 'Quincenal' : 'Mensual'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Día y fecha fin */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {frecuencia === 'semanal' ? 'Repetir todos los' : 'Día de la semana'}
                    </label>
                    <select
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(Number(e.target.value))}
                      className="input-field"
                    >
                      {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de fin</label>
                    <input
                      type="date"
                      value={fechaFin}
                      min={form.fecha}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Quincenal: qué semanas */}
                {frecuencia === 'quincenal' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">¿Qué semanas del mes?</label>
                    <div className="flex gap-2">
                      {([1, 2] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSemanaDelMes(n)}
                          className={cn(
                            'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                            semanaDelMes === n
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                          )}
                        >
                          {n === 1 ? '1ra y 3ra' : '2da y 4ta'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensual: qué semana */}
                {frecuencia === 'mensual' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">¿Qué semana del mes?</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSemanaDelMes(n)}
                          className={cn(
                            'py-1.5 text-xs font-medium rounded-lg border transition-colors',
                            semanaDelMes === n
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-primary/50'
                          )}
                        >
                          {n === 1 ? '1ra' : n === 2 ? '2da' : n === 3 ? '3ra' : '4ta'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                <p className="text-xs text-primary/80">
                  {frecuencia === 'semanal' && <>Todos los {DIAS_SEMANA[diaSemana].toLowerCase()} hasta el {format(new Date(fechaFin + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}.</>}
                  {frecuencia === 'quincenal' && <>Cada {semanaDelMes === 1 ? '1er y 3er' : '2do y 4to'} {DIAS_SEMANA[diaSemana].toLowerCase()} del mes hasta el {format(new Date(fechaFin + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}.</>}
                  {frecuencia === 'mensual' && <>Cada {semanaDelMes === 1 ? '1er' : semanaDelMes === 2 ? '2do' : semanaDelMes === 3 ? '3er' : '4to'} {DIAS_SEMANA[diaSemana].toLowerCase()} del mes hasta el {format(new Date(fechaFin + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}.</>}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => onClose ? onClose() : router.back()}
              className="btn-secondary flex-1 py-3"
            >
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={cn('btn-primary flex-1 py-3', loading && 'opacity-70')}>
              {loading ? 'Verificando...' : esFijo ? 'Crear serie' : 'Crear turno'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
