// Corre con: npx tsx --test src/lib/fecha-nacimiento.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayAIso, formatearMientrasEscribe, isoADisplay } from './fecha-nacimiento'

test('isoADisplay: ISO válido a dd/mm/aaaa', () => {
  assert.equal(isoADisplay('1985-03-15'), '15/03/1985')
})

test('isoADisplay: string vacío o no-ISO da vacío', () => {
  assert.equal(isoADisplay(''), '')
  assert.equal(isoADisplay('15/03/1985'), '')
})

test('displayAIso: fecha válida con barras', () => {
  assert.equal(displayAIso('15/03/1985'), '1985-03-15')
})

test('displayAIso: fecha válida sin barras (pegado)', () => {
  assert.equal(displayAIso('15031985'), '1985-03-15')
})

test('displayAIso: fecha válida pegada con guiones', () => {
  assert.equal(displayAIso('15-03-1985'), '1985-03-15')
})

test('displayAIso: 31/02 no existe', () => {
  assert.equal(displayAIso('31/02/1990'), null)
})

test('displayAIso: 31/04 no existe (abril tiene 30 días)', () => {
  assert.equal(displayAIso('31/04/1990'), null)
})

test('displayAIso: 29/02 en año bisiesto es válido', () => {
  assert.equal(displayAIso('29/02/2000'), '2000-02-29')
})

test('displayAIso: 29/02 en año no bisiesto es inválido', () => {
  assert.equal(displayAIso('29/02/2001'), null)
})

test('displayAIso: fecha futura es inválida', () => {
  const futuro = new Date()
  futuro.setUTCFullYear(futuro.getUTCFullYear() + 1)
  const dd = String(futuro.getUTCDate()).padStart(2, '0')
  const mm = String(futuro.getUTCMonth() + 1).padStart(2, '0')
  const aaaa = futuro.getUTCFullYear()
  assert.equal(displayAIso(`${dd}/${mm}/${aaaa}`), null)
})

test('displayAIso: hoy es válido (no futuro)', () => {
  const hoy = new Date()
  const dd = String(hoy.getUTCDate()).padStart(2, '0')
  const mm = String(hoy.getUTCMonth() + 1).padStart(2, '0')
  const aaaa = hoy.getUTCFullYear()
  assert.equal(displayAIso(`${dd}/${mm}/${aaaa}`), `${aaaa}-${mm}-${dd}`)
})

test('displayAIso: año menor a 1900 es inválido', () => {
  assert.equal(displayAIso('15/03/1899'), null)
})

test('displayAIso: año 1900 exacto es válido', () => {
  assert.equal(displayAIso('15/03/1900'), '1900-03-15')
})

test('displayAIso: incompleta (menos de 8 dígitos) da null', () => {
  assert.equal(displayAIso('15/03'), null)
  assert.equal(displayAIso(''), null)
})

test('formatearMientrasEscribe: va insertando las barras', () => {
  assert.equal(formatearMientrasEscribe('1'), '1')
  assert.equal(formatearMientrasEscribe('15'), '15')
  assert.equal(formatearMientrasEscribe('150'), '15/0')
  assert.equal(formatearMientrasEscribe('1503'), '15/03')
  assert.equal(formatearMientrasEscribe('15031'), '15/03/1')
  assert.equal(formatearMientrasEscribe('15031985'), '15/03/1985')
})

test('formatearMientrasEscribe: pegado con barras ya puestas no las duplica', () => {
  assert.equal(formatearMientrasEscribe('15/03/1985'), '15/03/1985')
})

test('formatearMientrasEscribe: pegado con guiones se reformatea con barras', () => {
  assert.equal(formatearMientrasEscribe('15-03-1985'), '15/03/1985')
})

test('formatearMientrasEscribe: ignora dígitos de más de 8', () => {
  assert.equal(formatearMientrasEscribe('150319850000'), '15/03/1985')
})

test('ida y vuelta: isoADisplay(displayAIso(x)) === x para una fecha válida', () => {
  const iso = displayAIso('05/07/1990')
  assert.ok(iso)
  assert.equal(isoADisplay(iso as string), '05/07/1990')
})
