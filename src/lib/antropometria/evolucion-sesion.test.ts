// Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumenEvolucionSesion, registroMasRecientePorTurno, turnoIdsSoloMedicion } from './evolucion-sesion'

test('igual: compararIgual da se_mantuvo aunque el crudo difiera por debajo de 1 decimal', () => {
  const r = resumenEvolucionSesion({ peso: 70, s6: 121, s8: 153 }, { peso: 70.04, s6: 121, s8: 153 })
  assert.ok(r)
  assert.equal(r!.peso!.direccion, 'se_mantuvo')
  assert.ok(Math.abs(r!.peso!.diferencia! - (70 - 70.04)) < 1e-9)
})

test('sube: dirección aumento con diferencia positiva', () => {
  const r = resumenEvolucionSesion({ peso: 71.2, s6: 129, s8: 163 }, { peso: 69.7, s6: 121, s8: 153 })
  assert.ok(r)
  assert.equal(r!.peso!.direccion, 'aumento')
  assert.ok(Math.abs(r!.peso!.diferencia! - 1.5) < 1e-9)
})

test('baja: dirección disminuyo con diferencia negativa', () => {
  const r = resumenEvolucionSesion({ peso: 69.7, s6: 121, s8: 153 }, { peso: 71.2, s6: 129, s8: 163 })
  assert.ok(r)
  assert.equal(r!.peso!.direccion, 'disminuyo')
  assert.ok(Math.abs(r!.peso!.diferencia! - (-1.5)) < 1e-9)
})

test('dato faltante: el campo sin valor actual se omite, los demás se calculan igual', () => {
  const r = resumenEvolucionSesion({ peso: 69.7, s6: 121, s8: null }, { peso: 71.2, s6: 129, s8: 163 })
  assert.ok(r)
  assert.equal('s8' in r!, false)
  assert.ok(r!.peso)
  assert.ok(r!.s6)
})

test('dato faltante en el previo: el campo queda con valor y sin diferencia/dirección (no se omite)', () => {
  const r = resumenEvolucionSesion({ peso: 69.7, s6: 121, s8: 153 }, { peso: 71.2, s6: null, s8: 163 })
  assert.ok(r)
  assert.equal(r!.s6!.valor, 121)
  assert.equal(r!.s6!.diferencia, null)
  assert.equal(r!.s6!.direccion, null)
  assert.equal(r!.peso!.direccion, 'disminuyo')
})

test('primera medición: sin previo, todos los campos quedan con valor y sin diferencia/dirección', () => {
  const r = resumenEvolucionSesion({ peso: 72.5, s6: 138, s8: 174 }, null)
  assert.ok(r)
  assert.equal(r!.peso!.valor, 72.5)
  assert.equal(r!.peso!.diferencia, null)
  assert.equal(r!.peso!.direccion, null)
  assert.equal(r!.s6!.diferencia, null)
  assert.equal(r!.s8!.diferencia, null)
})

test('los tres faltantes: devuelve null', () => {
  assert.equal(resumenEvolucionSesion({ peso: null, s6: null, s8: null }, { peso: 70, s6: 120, s8: 150 }), null)
})

test('dos mediciones en el mismo turno: se queda con la más reciente (por fecha y created_at)', () => {
  const porTurno = registroMasRecientePorTurno([
    { id: 'a', turno_id: 't1', fecha: '2026-04-18', created_at: '2026-04-18T10:00:00Z' },
    { id: 'b', turno_id: 't1', fecha: '2026-04-18', created_at: '2026-04-18T10:05:00Z' },
  ])
  assert.equal(porTurno.get('t1')?.id, 'b')
})

test('medición sin turno: no se asocia a ninguna sesión', () => {
  const porTurno = registroMasRecientePorTurno([
    { id: 'a', turno_id: null, fecha: '2026-04-18', created_at: '2026-04-18T10:00:00Z' },
  ])
  assert.equal(porTurno.size, 0)
})

test('medición con turno pero sin nota: entra en turnoIdsSoloMedicion', () => {
  const porTurno = registroMasRecientePorTurno([
    { id: 'a', turno_id: 't1', fecha: '2026-04-18', created_at: '2026-04-18T10:00:00Z' },
  ])
  const soloMedicion = turnoIdsSoloMedicion(new Set(), porTurno)
  assert.deepEqual(soloMedicion, ['t1'])
})

test('turno con nota: no entra en turnoIdsSoloMedicion aunque tenga medición', () => {
  const porTurno = registroMasRecientePorTurno([
    { id: 'a', turno_id: 't1', fecha: '2026-04-18', created_at: '2026-04-18T10:00:00Z' },
  ])
  const soloMedicion = turnoIdsSoloMedicion(new Set(['t1']), porTurno)
  assert.deepEqual(soloMedicion, [])
})

test('turno cancelado con medición: igual entra en turnoIdsSoloMedicion (el estado no filtra acá)', () => {
  const porTurno = registroMasRecientePorTurno([
    { id: 'a', turno_id: 't1', fecha: '2026-04-18', created_at: '2026-04-18T10:00:00Z' },
  ])
  // El estado del turno (cancelado, no_asistio, etc.) vive en la tabla turnos, no acá —
  // esta función no lo conoce ni lo necesita: solo decide si hay medición sin nota.
  const soloMedicion = turnoIdsSoloMedicion(new Set(), porTurno)
  assert.deepEqual(soloMedicion, ['t1'])
})
