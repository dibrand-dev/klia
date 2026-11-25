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

function puntoActual(svg: string): string {
  const m = svg.match(/<circle cx="[^"]+" cy="[^"]+" r="5.5"[^>]*>/)
  if (!m) throw new Error('No se encontró el punto "actual" en el SVG')
  return m[0]
}

test('somatochart: siluetas apagado (default) produce el mismo string que siluetas:false', () => {
  const pts = [{ x: -1.5, y: 2.3, kind: 'actual' as const }]
  const sinOpcion = somatochart(pts)
  const explicito = somatochart(pts, { siluetas: false })
  assert.equal(sinOpcion, explicito)
})

test('somatochart: siluetas:true agrega exactamente 3 <svg ...viewBox="0 0 120 240"', () => {
  const svg = somatochart([], { siluetas: true })
  const matches = svg.match(/<svg x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" viewBox="0 0 120 240"/g) ?? []
  assert.equal(matches.length, 3)
})

test('somatochart: siluetas:true no cambia la posición del punto "actual"', () => {
  const pts = [{ x: -1.5, y: 2.3, kind: 'actual' as const }]
  const sin = puntoActual(somatochart(pts))
  const con = puntoActual(somatochart(pts, { siluetas: true }))
  assert.equal(sin, con)
})

test('somatochart: siluetas:true agranda el viewBox hacia arriba (y inicial negativo)', () => {
  const svg = somatochart([], { siluetas: true })
  const m = svg.match(/^<svg viewBox="0 (-?[\d.]+) /)
  assert.ok(m, 'el SVG exterior debería tener viewBox="0 {minY} ..."')
  assert.ok(Number(m![1]) < 0, `esperaba un y inicial negativo, dio ${m![1]}`)
})
