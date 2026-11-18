// Tests de presentacion.ts. Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compararIgual, urlSocialSegura, etiquetaCategoriaCinturaCadera, porcentajesTejidos } from './presentacion'

test('compararIgual: compara a 1 decimal, redondeo half-up', () => {
  assert.equal(compararIgual(5.0, 5.04), true) // ambos redondean a 5,0
  assert.equal(compararIgual(5.04, 5.05), false) // 5,0 vs 5,1 (half-up)
  assert.equal(compararIgual(5.0, 5.1), false)
  assert.equal(compararIgual(-1.24, -1.2), true) // -1,2 vs -1,2
  assert.equal(compararIgual(null, 5), false)
  assert.equal(compararIgual(5, null), false)
  assert.equal(compararIgual(null, null), false)
})

test('urlSocialSegura: acepta http(s), antepone https:// si falta protocolo', () => {
  assert.equal(urlSocialSegura('instagram.com/mili.nutricion'), 'https://instagram.com/mili.nutricion')
  assert.equal(urlSocialSegura('https://instagram.com/mili.nutricion'), 'https://instagram.com/mili.nutricion')
  assert.equal(urlSocialSegura('http://instagram.com/mili.nutricion'), 'http://instagram.com/mili.nutricion')
})

test('urlSocialSegura: descarta esquemas peligrosos y valores inválidos', () => {
  assert.equal(urlSocialSegura('javascript:alert(1)'), null)
  assert.equal(urlSocialSegura('data:text/html,<script>alert(1)</script>'), null)
  assert.equal(urlSocialSegura('mailto:x@y.com'), null)
  assert.equal(urlSocialSegura(''), null)
  assert.equal(urlSocialSegura(null), null)
  assert.equal(urlSocialSegura(undefined), null)
  assert.equal(urlSocialSegura('   '), null)
  assert.equal(urlSocialSegura('not a url'), null)
})

test('etiquetaCategoriaCinturaCadera: mapea muy_alto a Muy alto, deja el resto con mayúscula inicial', () => {
  assert.equal(etiquetaCategoriaCinturaCadera('muy_alto'), 'Muy alto')
  assert.equal(etiquetaCategoriaCinturaCadera('bajo'), 'Bajo')
  assert.equal(etiquetaCategoriaCinturaCadera('moderado'), 'Moderado')
  assert.equal(etiquetaCategoriaCinturaCadera('alto'), 'Alto')
})

test('porcentajesTejidos: normaliza sobre la suma de los tres (nunca sobre la masa corporal); suma = 100', () => {
  const r = porcentajesTejidos({ adiposo: 24.95, muscular: 25.03, oseo: 9.64 })
  assert.ok(r)
  assert.equal(r!.adiposo, 41.8)
  assert.equal(r!.muscular, 42)
  assert.equal(r!.oseo, 16.2)
  assert.equal(Math.round((r!.adiposo + r!.muscular + r!.oseo) * 10) / 10, 100)
})

test('porcentajesTejidos: null si falta algún tejido o la suma es 0', () => {
  assert.equal(porcentajesTejidos({ adiposo: null, muscular: 10, oseo: 5 }), null)
  assert.equal(porcentajesTejidos({ adiposo: 10, muscular: null, oseo: 5 }), null)
  assert.equal(porcentajesTejidos({ adiposo: 10, muscular: 10, oseo: null }), null)
  assert.equal(porcentajesTejidos({ adiposo: 0, muscular: 0, oseo: 0 }), null)
})

test('porcentajesTejidos: ajusta el mayor cuando el redondeo deja la suma en 99,9 o 100,1 (nunca otro valor que 100)', () => {
  // 1/1/1 → 33,333...% c/u → redondea a 33,3/33,3/33,3 = 99,9: se ajusta el mayor (empate → el primero, adiposo) a 33,4
  const r = porcentajesTejidos({ adiposo: 1, muscular: 1, oseo: 1 })
  assert.ok(r)
  assert.equal(r!.adiposo, 33.4)
  assert.equal(r!.muscular, 33.3)
  assert.equal(r!.oseo, 33.3)
  assert.equal(Math.round((r!.adiposo + r!.muscular + r!.oseo) * 10) / 10, 100)
})
