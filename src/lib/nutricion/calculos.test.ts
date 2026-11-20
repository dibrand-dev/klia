// Corre con: npx tsx --test src/lib/nutricion/calculos.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clasificarIMC } from './calculos'

test('edad 17 (menor) → null, sin clasificar', () => {
  assert.equal(clasificarIMC(22, 17), null)
})

test('edad 18 (EDAD_ADULTO) → clasifica normal', () => {
  assert.deepEqual(clasificarIMC(22, 18), { label: 'Normal', status: 'success' })
})

test('edad null → clasifica como hoy (sin cambios)', () => {
  assert.deepEqual(clasificarIMC(22, null), { label: 'Normal', status: 'success' })
})

test('edad undefined → clasifica como hoy (sin cambios)', () => {
  assert.deepEqual(clasificarIMC(22, undefined), { label: 'Normal', status: 'success' })
})

test('sin segundo argumento (call sites no tocados) → clasifica, nunca null', () => {
  assert.deepEqual(clasificarIMC(22), { label: 'Normal', status: 'success' })
})

test('bordes de los cortes de adulto — sin regresión', () => {
  assert.deepEqual(clasificarIMC(18.4), { label: 'Bajo peso', status: 'info' })
  assert.deepEqual(clasificarIMC(18.5), { label: 'Normal', status: 'success' })
  assert.deepEqual(clasificarIMC(24.9), { label: 'Normal', status: 'success' })
  assert.deepEqual(clasificarIMC(25), { label: 'Sobrepeso', status: 'warning' })
  assert.deepEqual(clasificarIMC(29.9), { label: 'Sobrepeso', status: 'warning' })
  assert.deepEqual(clasificarIMC(30), { label: 'Obesidad', status: 'danger' })
})
