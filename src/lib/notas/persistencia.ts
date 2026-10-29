import type { SupabaseClient } from '@supabase/supabase-js'
import { n } from '@/lib/notas/calc-utils'
import type { ValoresModulo } from '@/lib/notas/modulos'

function hayAlgunDato(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => {
    if (v == null || v === '') return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })
}

interface Params {
  supabase: SupabaseClient
  especialidad: string | null | undefined
  valores: ValoresModulo
  terapeutaId: string
  pacienteId: string
  turnoId: string | null
  fecha: string
}

// Persiste los datos cargados en el módulo de especialidad al guardar la
// nota (nunca en el autoguardado de borrador). Si un insert falla, la nota
// clínica ya quedó guardada — se devuelve un mensaje puntual del módulo,
// mismo patrón que ya usaba el código de Antropometría/PIO.
export async function guardarDatosModulo({ supabase, especialidad, valores, terapeutaId, pacienteId, turnoId, fecha }: Params): Promise<{ error: string | null }> {
  const v = (k: string) => (valores[k] as string) ?? ''
  const arr = (k: string) => (valores[k] as string[]) ?? []

  if (especialidad === 'Nutrición') {
    const antropoValues = {
      peso: n(v('peso')),
      altura: n(v('alt')),
      cintura: n(v('cin')),
      cadera: n(v('cad')),
      porcentaje_grasa: n(v('grasa')),
      porcentaje_musculo: n(v('musc')),
      pliegue_tricipital: n(v('tri')),
      pliegue_subescapular: n(v('sub')),
      pliegue_suprailiaco: n(v('supra')),
      pliegue_abdominal: n(v('abd')),
      perimetro_brazo: n(v('brazo')),
      perimetro_pierna: n(v('pant')),
    }
    if (hayAlgunDato(antropoValues)) {
      const { error } = await supabase.from('registros_antropometricos').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, ...antropoValues,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar los datos antropométricos.' }
    }
    return { error: null }
  }

  if (especialidad === 'Oftalmología') {
    const pioValues = {
      pio_medida_od: n(v('pio_od')),
      paquimetria_od: n(v('paq_od')),
      pio_medida_oi: n(v('pio_oi')),
      paquimetria_oi: n(v('paq_oi')),
    }
    if (hayAlgunDato(pioValues)) {
      const { error } = await supabase.from('registros_pio').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, ...pioValues,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar el registro de PIO.' }
    }

    const rxValues = {
      sph_od: n(v('esf_od')), cyl_od: n(v('cil_od')), axis_od: n(v('eje_od')), add_od: n(v('add_od')), av_od: v('av_od_cc') || null,
      sph_oi: n(v('esf_oi')), cyl_oi: n(v('cil_oi')), axis_oi: n(v('eje_oi')), add_oi: n(v('add_oi')), av_oi: v('av_oi_cc') || null,
    }
    if (hayAlgunDato(rxValues)) {
      const { error } = await supabase.from('registros_refraccion').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, ...rxValues,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar la refracción.' }
    }

    const datosEsp = {
      av_sc: { od: v('av_od_sc') || null, oi: v('av_oi_sc') || null },
      av_cc: { od: v('av_od_cc') || null, oi: v('av_oi_cc') || null },
      biomicroscopia: v('bio') || null,
      fondo_de_ojo: v('fo') || null,
      cie10: arr('cie_of'),
    }
    if (hayAlgunDato({ ...datosEsp.av_sc, ...datosEsp.av_cc, biomicroscopia: datosEsp.biomicroscopia, fondo_de_ojo: datosEsp.fondo_de_ojo, cie10: datosEsp.cie10 })) {
      const { error } = await supabase.from('registros_especialidad').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha,
        especialidad: 'Oftalmología', datos: datosEsp,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar el registro de oftalmología.' }
    }
    return { error: null }
  }

  if (especialidad === 'Kinesiología') {
    const datos = { eva: v('eva') || null, zona: v('zona') || null, lado: v('lado') || null, mov: v('mov') || null, rom: n(v('rom')), daniels: v('daniels') || null, ses: n(v('ses')), sest: n(v('sest')) }
    if (hayAlgunDato(datos)) {
      const { error } = await supabase.from('registros_especialidad').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, especialidad: 'Kinesiología', datos,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar la evaluación kinésica.' }
    }
    return { error: null }
  }

  if (especialidad === 'Odontología') {
    const datos = { piezas: arr('piezas'), caras: arr('caras'), prestacion: v('prest') || null, cie10: arr('cie_od') }
    if (hayAlgunDato(datos)) {
      const { error } = await supabase.from('registros_especialidad').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, especialidad: 'Odontología', datos,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar la prestación odontológica.' }
    }
    return { error: null }
  }

  if (especialidad === 'Psicología') {
    const datos = { phq: n(v('phq')), gad: n(v('gad')), riesgo: arr('riesgo')[0] ?? null }
    if (hayAlgunDato(datos)) {
      const { error } = await supabase.from('registros_especialidad').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, especialidad: 'Psicología', datos,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar las escalas.' }
    }
    return { error: null }
  }

  if (especialidad === 'Clínica Médica') {
    const datos = { tas: n(v('tas')), tad: n(v('tad')), fc: n(v('fc')), fr: n(v('fr')), temp: n(v('temp')), sat: n(v('sat')), peso: n(v('peso')), alt: n(v('alt')), cie10: arr('cie_cm') }
    if (hayAlgunDato(datos)) {
      const { error } = await supabase.from('registros_especialidad').insert({
        terapeuta_id: terapeutaId, paciente_id: pacienteId, turno_id: turnoId, fecha, especialidad: 'Clínica Médica', datos,
      } as never)
      if (error) return { error: 'La nota se guardó, pero hubo un error al guardar los signos vitales.' }
    }
    return { error: null }
  }

  return { error: null }
}
