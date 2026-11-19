// Corre con: npx tsx --test src/lib/historial/armarImpresion.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarHistorialParaImprimir } from './armarImpresion'
import type { Paciente, NotaClinica, TurnoRow, RegistroAntropometrico } from '@/types/database'

const paciente = { genero: 'F', fecha_nacimiento: '1990-01-01' } as unknown as Paciente

function nota(over: Partial<NotaClinica> = {}): NotaClinica {
  return {
    id: 'n1', paciente_id: 'p1', terapeuta_id: 't1', turno_id: 't-turno', fecha: '2026-04-18',
    hora_nota: null, created_at: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z',
    contenido: '<p>texto</p>', borrador: false,
    ...over,
  } as unknown as NotaClinica
}

function turno(over: Partial<TurnoRow> = {}): TurnoRow {
  return {
    id: 't-turno', paciente_id: 'p1', terapeuta_id: 't1', fecha_hora: '2026-04-18T13:00:00Z',
    modalidad: 'presencial', tipo_turno: 'Consulta', estado: 'realizado',
    ...over,
  } as unknown as TurnoRow
}

const REGISTRO_BASE: Partial<RegistroAntropometrico> = {
  id: 'r1', paciente_id: 'p1', terapeuta_id: 't1', turno_id: 't-turno', fecha: '2026-04-18',
  metodo_medicion: 'basico',
  peso: 70, altura: 165, cintura: 75, cadera: 95, porcentaje_grasa: null, porcentaje_musculo: null,
  pliegue_tricipital: null, pliegue_subescapular: null, pliegue_suprailiaco: null, pliegue_abdominal: null,
  perimetro_brazo: null, perimetro_pierna: null,
  pliegue_biceps: null, pliegue_cresta_iliaca: null, pliegue_supraespinal: null, pliegue_muslo: null, pliegue_pantorrilla: null,
  perimetro_brazo_contraido: null, perimetro_muslo_medio: null,
  diametro_humero: null, diametro_biestiloideo: null, diametro_femur: null,
  talla_sentado: null, envergadura: null,
}

function registro(over: Partial<RegistroAntropometrico> = {}): RegistroAntropometrico {
  return { ...REGISTRO_BASE, ...over } as unknown as RegistroAntropometrico
}

test('registro legacy (básico): sin cambios — ningún campo ISAK, metodo no es isak', () => {
  const r = registro()
  const res = armarHistorialParaImprimir({
    especialidadProfesional: 'Nutrición', terminologia: 'sesion', tiposTurno: [], paciente,
    notas: [nota()], turnos: [turno()], registrosAntropometricos: [r],
    registrosPio: [], registrosRefraccion: [], registrosEspecialidad: [],
  })
  const bloque = res.notas[0].modulo
  assert.ok(bloque && bloque.tipo === 'Nutrición')
  const antro = bloque.antro
  assert.equal(antro.peso, 70)
  assert.equal(antro.metodo, 'basico')
  assert.equal(antro.pliegueBiceps, null)
  assert.equal(antro.s6, null)
  assert.equal(antro.s8, null)
})

test('registro ISAK completo: Σ6/Σ8 calculados con calcular() de la librería, mismos valores que el bloque del Historial', () => {
  const r = registro({
    metodo_medicion: 'isak',
    pliegue_tricipital: 10, pliegue_subescapular: 12, pliegue_biceps: 5, pliegue_cresta_iliaca: 15,
    pliegue_supraespinal: 8, pliegue_abdominal: 20, pliegue_muslo: 18, pliegue_pantorrilla: 12,
  })
  const res = armarHistorialParaImprimir({
    especialidadProfesional: 'Nutrición', terminologia: 'sesion', tiposTurno: [], paciente,
    notas: [nota()], turnos: [turno()], registrosAntropometricos: [r],
    registrosPio: [], registrosRefraccion: [], registrosEspecialidad: [],
  })
  const bloque = res.notas[0].modulo
  assert.ok(bloque && bloque.tipo === 'Nutrición')
  const antro = bloque.antro
  assert.equal(antro.metodo, 'isak')
  assert.equal(antro.s6, 80)
  assert.equal(antro.s8, 100)
  assert.equal(antro.pliegueBiceps, 5)
  assert.equal(antro.pliegueCrestaIliaca, 15)
})

test('registro ISAK parcial: falta un pliegue (cresta ilíaca) → Σ8 null, Σ6 se calcula igual, nunca se inventa el dato faltante', () => {
  const r = registro({
    metodo_medicion: 'isak',
    pliegue_tricipital: 10, pliegue_subescapular: 12, pliegue_biceps: 5, pliegue_cresta_iliaca: null,
    pliegue_supraespinal: 8, pliegue_abdominal: 20, pliegue_muslo: 18, pliegue_pantorrilla: 12,
  })
  const res = armarHistorialParaImprimir({
    especialidadProfesional: 'Nutrición', terminologia: 'sesion', tiposTurno: [], paciente,
    notas: [nota()], turnos: [turno()], registrosAntropometricos: [r],
    registrosPio: [], registrosRefraccion: [], registrosEspecialidad: [],
  })
  const bloque = res.notas[0].modulo
  assert.ok(bloque && bloque.tipo === 'Nutrición')
  const antro = bloque.antro
  assert.equal(antro.s6, 80)
  assert.equal(antro.s8, null)
  assert.equal(antro.pliegueCrestaIliaca, null)
})
