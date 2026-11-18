// Tests mínimos de graficos.ts. Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, sgn, fecha, somatochart, pie } from './graficos'

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

test('pie genera un SVG válido con una porción por tejido', () => {
  const svg = pie([{ v: 25, c: '#A65A06' }, { v: 25, c: '#1F4FD9' }, { v: 10, c: '#1F2937' }, { v: 10, c: '#AEB5C0' }], 150)
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('</svg>'))
  assert.equal((svg.match(/<path/g) ?? []).length, 4)
})

test('pie con una sola porción dibuja el círculo completo sin romper', () => {
  const svg = pie([{ v: 100, c: '#000' }])
  assert.ok(svg.includes('<path'))
})

test('somatochart: etiquetas por defecto (sin pasar labels)', () => {
  const svg = somatochart([])
  assert.ok(svg.includes('MESOMORFO'))
  assert.ok(svg.includes('ENDOMORFO'))
  assert.ok(svg.includes('ECTOMORFO'))
})

test('somatochart: labels:false oculta las etiquetas', () => {
  const svg = somatochart([], { labels: false })
  assert.ok(!svg.includes('MESOMORFO'))
  assert.ok(!svg.includes('ENDOMORFO'))
  assert.ok(!svg.includes('ECTOMORFO'))
})

test('somatochart: labels como objeto reemplaza el texto, sin .replace() sobre el SVG', () => {
  const svg = somatochart([], { labels: { endo: 'ENDOMORFIA', meso: 'MESOMORFIA', ecto: 'ECTOMORFIA' } })
  assert.ok(svg.includes('MESOMORFIA'))
  assert.ok(svg.includes('ENDOMORFIA'))
  assert.ok(svg.includes('ECTOMORFIA'))
  assert.ok(!svg.includes('MESOMORFO<'))
  assert.ok(!svg.includes('ENDOMORFO<'))
  assert.ok(!svg.includes('ECTOMORFO<'))
})

test('somatochart: labels como objeto parcial usa el default para las claves faltantes', () => {
  const svg = somatochart([], { labels: { meso: 'MESOMORFIA' } })
  assert.ok(svg.includes('MESOMORFIA'))
  assert.ok(svg.includes('ENDOMORFO'))
  assert.ok(svg.includes('ECTOMORFO'))
})

test('somatochart: labels:true (compat) sigue mostrando las etiquetas default', () => {
  const svg = somatochart([], { labels: true })
  assert.ok(svg.includes('MESOMORFO'))
})
