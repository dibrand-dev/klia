// Corre con: npx tsx --test src/lib/matriculas-publicas.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matriculasParaMostrar, tieneMatriculaVerificada } from './matriculas-publicas'

test('matriculasParaMostrar: M.N. siempre antes que M.P., sin importar el orden de entrada', () => {
  const resultado = matriculasParaMostrar([
    { tipo: 'provincial', numero: '6248', habilitada: true, verificada: true },
    { tipo: 'nacional', numero: '9585', habilitada: true, verificada: true },
  ])
  assert.deepEqual(resultado, [
    { etiqueta: 'M.N.', numero: '9585' },
    { etiqueta: 'M.P.', numero: '6248' },
  ])
})

test('matriculasParaMostrar: habilitada false se descarta', () => {
  const resultado = matriculasParaMostrar([
    { tipo: 'nacional', numero: '1111', habilitada: false, verificada: true },
    { tipo: 'provincial', numero: '2222', habilitada: true, verificada: true },
  ])
  assert.deepEqual(resultado, [{ etiqueta: 'M.P.', numero: '2222' }])
})

test('matriculasParaMostrar: habilitada null se muestra', () => {
  const resultado = matriculasParaMostrar([
    { tipo: 'nacional', numero: '3333', habilitada: null, verificada: false },
  ])
  assert.deepEqual(resultado, [{ etiqueta: 'M.N.', numero: '3333' }])
})

test('matriculasParaMostrar: numero vacío se descarta', () => {
  const resultado = matriculasParaMostrar([
    { tipo: 'nacional', numero: '', habilitada: true, verificada: true },
    { tipo: 'provincial', numero: '4444', habilitada: true, verificada: true },
  ])
  assert.deepEqual(resultado, [{ etiqueta: 'M.P.', numero: '4444' }])
})

test('matriculasParaMostrar: duplicados por (etiqueta, numero) se descartan', () => {
  const resultado = matriculasParaMostrar([
    { tipo: 'nacional', numero: '5555', habilitada: true, verificada: true },
    { tipo: 'nacional', numero: '5555', habilitada: true, verificada: true },
  ])
  assert.deepEqual(resultado, [{ etiqueta: 'M.N.', numero: '5555' }])
})

test('matriculasParaMostrar: tipo distinto a nacional siempre es M.P. (incluye null)', () => {
  const resultado = matriculasParaMostrar([
    { tipo: null, numero: '6666', habilitada: true, verificada: true },
  ])
  assert.deepEqual(resultado, [{ etiqueta: 'M.P.', numero: '6666' }])
})

test('matriculasParaMostrar: lista vacía da lista vacía', () => {
  assert.deepEqual(matriculasParaMostrar([]), [])
})

test('tieneMatriculaVerificada: verificada true + habilitada true → true', () => {
  assert.equal(tieneMatriculaVerificada([
    { tipo: 'nacional', numero: '1', habilitada: true, verificada: true },
  ]), true)
})

test('tieneMatriculaVerificada: verificada true con habilitada null → false', () => {
  assert.equal(tieneMatriculaVerificada([
    { tipo: 'nacional', numero: '1', habilitada: null, verificada: true },
  ]), false)
})

test('tieneMatriculaVerificada: manual sin verificar → false', () => {
  assert.equal(tieneMatriculaVerificada([
    { tipo: 'provincial', numero: '1', habilitada: true, verificada: false },
  ]), false)
})

test('tieneMatriculaVerificada: lista vacía → false', () => {
  assert.equal(tieneMatriculaVerificada([]), false)
})
