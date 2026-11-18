// Tests de presentacion.ts. Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compararIgual, urlSocialSegura, etiquetaCategoriaCinturaCadera } from './presentacion'

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
