// Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distribucionAdiposoMuscular } from './distribucion'

const cerca = (real: number | null, esperado: number, tol: number, etiqueta: string) => {
  assert.notEqual(real, null, `${etiqueta}: es null`)
  assert.ok(Math.abs((real as number) - esperado) <= tol, `${etiqueta}: real ${real} vs esperado ${esperado} (±${tol})`)
}

test('golden: caso de referencia (Agustín)', () => {
  const r = distribucionAdiposoMuscular({
    triceps: 19, subescapular: 17.5, supraespinal: 19, abdominal: 16, muslo: 27, pantorrilla: 22.5,
    brazoCorregido: 24.03, musloCorregido: 41.02, piernaCorregida: 29.43,
  })
  assert.ok(r.adiposo)
  cerca(r.adiposo!.superior, 30.17, 0.01, 'adiposo superior')
  cerca(r.adiposo!.central, 28.93, 0.01, 'adiposo central')
  cerca(r.adiposo!.inferior, 40.91, 0.01, 'adiposo inferior')
  assert.ok(r.muscular)
  cerca(r.muscular!.brazo, 25.43, 0.01, 'muscular brazo')
  cerca(r.muscular!.muslo, 43.41, 0.01, 'muscular muslo')
  cerca(r.muscular!.pierna, 31.15, 0.01, 'muscular pierna')
})

test('dato faltante: cada grupo es null por separado, nunca se inventa un valor', () => {
  const sinAdiposo = distribucionAdiposoMuscular({
    triceps: 19, subescapular: 17.5, supraespinal: 19, abdominal: null, muslo: 27, pantorrilla: 22.5,
    brazoCorregido: 24.03, musloCorregido: 41.02, piernaCorregida: 29.43,
  })
  assert.equal(sinAdiposo.adiposo, null)
  assert.ok(sinAdiposo.muscular)

  const sinMuscular = distribucionAdiposoMuscular({
    triceps: 19, subescapular: 17.5, supraespinal: 19, abdominal: 16, muslo: 27, pantorrilla: 22.5,
    brazoCorregido: 24.03, musloCorregido: null, piernaCorregida: 29.43,
  })
  assert.ok(sinMuscular.adiposo)
  assert.equal(sinMuscular.muscular, null)

  const sinNada = distribucionAdiposoMuscular({})
  assert.equal(sinNada.adiposo, null)
  assert.equal(sinNada.muscular, null)
})
