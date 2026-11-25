// Corre con: npx tsx --test src/lib/nutricion/pediatria.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edad, clasificarIndicador, clasificarPediatrico, type TablaOMS } from './pediatria'
import golden from './oms/golden-oms.json'
import omsLms from './oms/oms-lms.json'

const oms = omsLms as unknown as TablaOMS

interface CasoGolden {
  ind: 'bmi' | 'talla'
  sexo: 'M' | 'F'
  tabla: 'dias' | 'meses'
  edad: number
  valor: number
  esperado: string
}

test('golden-oms.json: 252 casos de oro OMS', () => {
  const casos = golden.casos as CasoGolden[]
  assert.equal(casos.length, 252)
  for (const c of casos) {
    const res = clasificarIndicador(oms, c.ind, c.sexo, c.tabla, c.edad, c.valor)
    assert.ok(res, `sin resultado para ${JSON.stringify(c)}`)
    assert.equal(
      res!.categoria,
      c.esperado,
      `ind=${c.ind} sexo=${c.sexo} tabla=${c.tabla} edad=${c.edad} valor=${c.valor}: esperaba ${c.esperado}, dio ${res!.categoria}`,
    )
  }
})

test('edad: días y meses completos, sin depender del huso horario', () => {
  assert.deepEqual(edad('2020-01-01', '2021-01-01'), { dias: 366, mesesCompletos: 12 })
  assert.deepEqual(edad('2020-01-15', '2020-02-10'), { dias: 26, mesesCompletos: 0 })
  assert.deepEqual(edad('2020-01-15', '2020-02-15'), { dias: 31, mesesCompletos: 1 })
})

test('edad: el resultado en días no cambia según TZ del proceso', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    const a = edad('2010-03-01', '2024-03-01')
    process.env.TZ = 'Etc/GMT+12' // UTC-12
    const b = edad('2010-03-01', '2024-03-01')
    assert.deepEqual(a, b)
  } finally {
    process.env.TZ = original
  }
})

test('clasificarPediatrico: edad < 12 meses → null', async () => {
  const res = await clasificarPediatrico({
    sexo: 'M', fechaNacimiento: '2026-01-01', fechaReferencia: '2026-10-01', pesoKg: 8, tallaCm: 70,
  })
  assert.equal(res, null)
})

test('clasificarPediatrico: edad ≥ 18 años (216 meses) → null', async () => {
  const res = await clasificarPediatrico({
    sexo: 'F', fechaNacimiento: '2008-01-01', fechaReferencia: '2026-01-01', pesoKg: 55, tallaCm: 160,
  })
  assert.equal(res, null)
})

test('clasificarPediatrico: sexo null → null', async () => {
  const res = await clasificarPediatrico({
    sexo: null, fechaNacimiento: '2018-01-01', fechaReferencia: '2026-01-01', pesoKg: 25, tallaCm: 120,
  })
  assert.equal(res, null)
})

test('clasificarPediatrico: peso 0 → null', async () => {
  const res = await clasificarPediatrico({
    sexo: 'M', fechaNacimiento: '2018-01-01', fechaReferencia: '2026-01-01', pesoKg: 0, tallaCm: 120,
  })
  assert.equal(res, null)
})

test('clasificarPediatrico: IMC improbable (|z|>5) → null', async () => {
  const res = await clasificarPediatrico({
    sexo: 'M', fechaNacimiento: '2018-01-01', fechaReferencia: '2026-01-01', pesoKg: 300, tallaCm: 120,
  })
  assert.equal(res, null)
})

test('clasificarPediatrico: caso válido con sexo y datos completos', async () => {
  const res = await clasificarPediatrico({
    sexo: 'M', fechaNacimiento: '2020-01-01', fechaReferencia: '2021-01-01', pesoKg: 10, tallaCm: 75,
  })
  assert.ok(res)
  assert.equal(res!.edadMeses, 12)
  assert.ok(['bajo_peso', 'adecuado', 'sobrepeso', 'obesidad'].includes(res!.imcCategoria))
  assert.ok(['adecuada', 'baja_talla'].includes(res!.tallaCategoria))
})
