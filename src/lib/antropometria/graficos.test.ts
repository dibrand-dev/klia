// Tests mínimos de graficos.ts. Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, sgn, fecha, somatochart } from './graficos'

test('fmt formatea en es-AR', () => {
  assert.equal(fmt(5.59), '5,6')
  assert.equal(fmt(5.04, 2), '5,04')
  assert.equal(fmt(-1.2), '−1,2')
  assert.equal(fmt(null), '—')
  assert.equal(fmt(undefined), '—')
  assert.equal(fmt(NaN), '—')
})

test('sgn antepone signo', () => {
  assert.equal(sgn(1.2), '+1,2')
  assert.equal(sgn(-1.2), '−1,2')
  assert.equal(sgn(0), '0,0')
  assert.equal(sgn(null), '—')
})

test('fecha convierte ISO a DD/MM/YYYY', () => {
  assert.equal(fecha('2026-04-13'), '13/04/2026')
})

test('somatochart genera SVG válido con puntos', () => {
  const svg = somatochart([
    { x: -1.5, y: 2.3, kind: 'actual' },
    { x: -1.2, y: 2.0, kind: 'previo' },
  ])
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('</svg>'))
  assert.ok(svg.includes('MESOMORFO'))
})

test('somatochart filtra puntos sin x/y e ignora null/undefined', () => {
  const svg = somatochart([null, undefined, { x: 0, y: 0, kind: 'actual' }])
  assert.ok(svg.startsWith('<svg'))
})

test('somatochart sin puntos no rompe', () => {
  const svg = somatochart([])
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('</svg>'))
})
