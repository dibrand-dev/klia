// Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolverTurnoParaRegistro, diaCalendarioAR, rangoDiaCalendarioAR, type TurnoCandidato } from './resolverTurno'

const AHORA = new Date('2026-04-18T15:00:00.000Z') // 12:00 AR

test('un turno ese día: lo devuelve', () => {
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-18T13:00:00.000Z', estado: 'realizado' }]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), 't1')
})

test('ningún turno ese día: null', () => {
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-19T13:00:00.000Z', estado: 'realizado' }]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), null)
})

test('turno cancelado: se ignora (queda sin candidatos → null)', () => {
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-18T13:00:00.000Z', estado: 'cancelado' }]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), null)
})

test('turno de otro día: se ignora', () => {
  const turnos: TurnoCandidato[] = [
    { id: 'hoy', fecha_hora: '2026-04-18T13:00:00.000Z', estado: 'realizado' },
    { id: 'otro-dia', fecha_hora: '2026-04-20T13:00:00.000Z', estado: 'realizado' },
  ]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), 'hoy')
})

test('borde de medianoche AR: turno 23:30 local del 18 (= 02:30 UTC del 19) cuenta como día 18', () => {
  assert.equal(diaCalendarioAR('2026-04-19T02:30:00.000Z'), '2026-04-18')
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-19T02:30:00.000Z', estado: 'realizado' }]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), 't1')
  // y NO cuenta para el día 19
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-19', new Set(), AHORA), null)
})

test('turno ocupado por otro registro: se ignora', () => {
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-18T13:00:00.000Z', estado: 'realizado' }]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(['t1']), AHORA), null)
})

test('edición del mismo registro: su turno no se considera ocupado (el caller lo excluye del Set)', () => {
  const turnos: TurnoCandidato[] = [{ id: 't1', fecha_hora: '2026-04-18T13:00:00.000Z', estado: 'realizado' }]
  // turnoIdsOcupados vacío porque el caller ya excluyó el registro en edición del cálculo
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), 't1')
})

test('varios turnos con fecha pasada (no hoy): null, nunca se adivina', () => {
  // "ahora" es el 18 (hoy real); fechaRegistro es el 17 (día anterior, elegido a mano).
  const turnos: TurnoCandidato[] = [
    { id: 't1', fecha_hora: '2026-04-17T13:00:00.000Z', estado: 'realizado' },
    { id: 't2', fecha_hora: '2026-04-17T16:00:00.000Z', estado: 'realizado' },
  ]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-17', new Set(), AHORA), null)
})

test('varios turnos hoy: elige el más cercano a ahora', () => {
  const turnos: TurnoCandidato[] = [
    { id: 'lejos', fecha_hora: '2026-04-18T10:00:00.000Z', estado: 'realizado' }, // 5hs antes
    { id: 'cerca', fecha_hora: '2026-04-18T14:30:00.000Z', estado: 'realizado' }, // 30min antes
  ]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), 'cerca')
})

test('varios turnos hoy, empate de distancia a ahora: null', () => {
  const turnos: TurnoCandidato[] = [
    { id: 'antes', fecha_hora: '2026-04-18T14:00:00.000Z', estado: 'realizado' }, // 1h antes
    { id: 'despues', fecha_hora: '2026-04-18T16:00:00.000Z', estado: 'realizado' }, // 1h después
  ]
  assert.equal(resolverTurnoParaRegistro(turnos, '2026-04-18', new Set(), AHORA), null)
})

test('rangoDiaCalendarioAR: cubre exactamente el día AR en UTC', () => {
  const { desde, hasta } = rangoDiaCalendarioAR('2026-04-18')
  assert.equal(desde, '2026-04-18T03:00:00.000Z')
  assert.equal(hasta, '2026-04-19T03:00:00.000Z')
})
