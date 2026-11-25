// Tests de fuentes.ts (autor de cada corte/fórmula del informe profesional).
// Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FUENTES, fuenteDe, type ClaveFuente } from './fuentes'

const CON_FUENTE: ClaveFuente[] = ['tejidoAdiposo', 'tejidoMuscular', 'tejidoOseo', 'somatotipo', 'conicidad', 'imc', 'cinturaCaderaOms']
const PENDIENTES: ClaveFuente[] = ['cinturaCaderaPorEdad', 'musculoOseo', 'cormico', 'manouvrier', 'cinturaTalla']

test('las 7 claves confirmadas devuelven un texto no vacío', () => {
  for (const clave of CON_FUENTE) {
    const texto = fuenteDe(clave)
    assert.equal(typeof texto, 'string', `${clave} no es string`)
    assert.ok((texto as string).trim().length > 0, `${clave} está vacío`)
  }
})

test('las 5 claves pendientes devuelven null', () => {
  for (const clave of PENDIENTES) {
    assert.equal(fuenteDe(clave), null, `${clave} debería ser null`)
  }
})

test('FUENTES y fuenteDe son consistentes, y no sobran ni faltan claves', () => {
  for (const clave of [...CON_FUENTE, ...PENDIENTES]) {
    assert.equal(fuenteDe(clave), FUENTES[clave])
  }
  assert.equal(Object.keys(FUENTES).length, CON_FUENTE.length + PENDIENTES.length)
})
