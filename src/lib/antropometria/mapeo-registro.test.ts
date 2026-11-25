// Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { medidasDesdeRegistro } from './mapeo-registro'
import { calcular } from './calculos'

// Caso real que reprodujo el bug: el select de historial/page.tsx no traía
// pliegue_biceps/pliegue_cresta_iliaca, así que Σ8 quedaba siempre null aunque
// estuvieran los 8 pliegues cargados en registros_antropometricos.
const REGISTRO_8_PLIEGUES = {
  pliegue_tricipital: 10, pliegue_subescapular: 12, pliegue_biceps: 5, pliegue_cresta_iliaca: 15,
  pliegue_supraespinal: 8, pliegue_abdominal: 20, pliegue_muslo: 18, pliegue_pantorrilla: 12,
}

test('medidasDesdeRegistro → calcular: Σ8 con los 8 pliegues del registro (incluye bíceps y cresta ilíaca)', () => {
  const medidas = medidasDesdeRegistro(REGISTRO_8_PLIEGUES)
  const r = calcular(medidas, { sexo: null, edad: null })
  assert.equal(r.sumatorias.s6, 80)
  assert.equal(r.sumatorias.s8, 100)
})

test('medidasDesdeRegistro → calcular: falta uno de los 8 (cresta ilíaca) → Σ8 queda null, Σ6 se calcula igual', () => {
  const medidas = medidasDesdeRegistro({ ...REGISTRO_8_PLIEGUES, pliegue_cresta_iliaca: null })
  const r = calcular(medidas, { sexo: null, edad: null })
  assert.equal(r.sumatorias.s6, 80)
  assert.equal(r.sumatorias.s8, null)
})
