// Corre con: npx tsx --test src/lib/facturacion/cuit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarCuit, validarCuit, formatearCuit } from './cuit'

test('CUIT válido: 20123456786', () => {
  assert.equal(validarCuit('20123456786'), true)
})

test('cambiar el último dígito lo hace inválido', () => {
  assert.equal(validarCuit('20123456787'), false)
})

test('con guiones normaliza y valida', () => {
  assert.equal(normalizarCuit('20-12345678-6'), '20123456786')
  assert.equal(validarCuit('20-12345678-6'), true)
})

test('largo incorrecto es inválido', () => {
  assert.equal(validarCuit('2012345678'), false)
  assert.equal(validarCuit('201234567860'), false)
})

test('vacío es inválido', () => {
  assert.equal(validarCuit(''), false)
})

test('letras son inválidas', () => {
  assert.equal(validarCuit('2a1234567b6'), false)
})

test('prefijo 99 es inválido', () => {
  assert.equal(validarCuit('99123456786'), false)
})

test('formatearCuit("20123456786") → "20-12345678-6"', () => {
  assert.equal(formatearCuit('20123456786'), '20-12345678-6')
})

test('formatearCuit con menos de 11 dígitos devuelve tal cual', () => {
  assert.equal(formatearCuit('201234'), '201234')
})
