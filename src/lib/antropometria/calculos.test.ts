// Tests de oro: 4 informes reales de ISAKMetry (spec §8). Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcular, categoriaMusculoOseo, categoriaCormico, categoriaManouvrier, redondear, zPhantom, type Medidas, type Paciente } from './calculos'

interface Caso {
  nombre: string; pac: Paciente; m: Medidas
  esp: {
    endo: number; meso: number; ecto: number; adi: number; mus: number; ose: number
    adiMus: number; musOse: number; cormico: number; manou: number; con: number
    s6: number; s8: number; imc: number; icc: number; ict: number
  }
}

const pl = (a: number[]) => ({ triceps: a[0], subescapular: a[1], biceps: a[2], crestaIliaca: a[3], supraespinal: a[4], abdominal: a[5], muslo: a[6], pantorrilla: a[7] })
const pe = (a: number[]) => ({ brazoRelajado: a[0], brazoContraido: a[1], cintura: a[2], cadera: a[3], musloMedio: a[4], pierna: a[5] })
const di = (a: number[]) => ({ humero: a[0], biestiloideo: a[1], femur: a[2] })

const CASOS: Caso[] = [
  {
    nombre: 'Agustín', pac: { sexo: 'M', edad: 23 },
    m: { talla: 166, masa: 69.7, tallaSentado: 83.8, envergadura: 164.5, ...pl([19, 17.5, 12.5, 19.5, 19, 16, 27, 22.5]), ...pe([30, 29, 80.5, 101.8, 49.5, 36.5]), ...di([6.0, 5.2, 8.9]) },
    esp: { endo: 5.59, meso: 3.86, ecto: 1.05, adi: 24.95, mus: 25.03, ose: 9.64, adiMus: 1.0, musOse: 2.6, cormico: 0.5, manou: 98, con: 1.14, s6: 121, s8: 153, imc: 25.3, icc: 0.79, ict: 0.48 },
  },
  {
    nombre: 'Natalia', pac: { sexo: 'F', edad: 38 },
    m: { talla: 165, masa: 74.3, tallaSentado: 78.0, envergadura: 165.2, ...pl([20, 19, 9, 22.5, 16, 19, 34.5, 24]), ...pe([30.3, 30.8, 80.7, 112.5, 61.3, 39.8]), ...di([6.1, 5.6, 9.2]) },
    esp: { endo: 5.58, meso: 5.08, ecto: 0.54, adi: 26.44, mus: 24.33, ose: 10.31, adiMus: 1.09, musOse: 2.36, cormico: 0.47, manou: 112, con: 1.1, s6: 132.5, s8: 164, imc: 27.3, icc: 0.72, ict: 0.49 },
  },
  {
    nombre: 'Laura', pac: { sexo: 'F', edad: 50 },
    m: { talla: 157, masa: 52.1, tallaSentado: 87.5, envergadura: 157.0, ...pl([14.5, 7, 3.5, 10, 5, 10, 22.5, 20]), ...pe([25, 26, 66.4, 93.2, 48.5, 35.5]), ...di([6.0, 5.0, 8.3]) },
    esp: { endo: 2.92, meso: 4.08, ecto: 2.19, adi: 16.04, mus: 18.56, ose: 8.24, adiMus: 0.86, musOse: 2.25, cormico: 0.56, manou: 79, con: 1.06, s6: 79, s8: 92.5, imc: 21.1, icc: 0.71, ict: 0.42 },
  },
  {
    nombre: 'Miguel', pac: { sexo: 'M', edad: 60 },
    m: { talla: 170, masa: 107.5, tallaSentado: 88.0, envergadura: 183.0, ...pl([32, 34, 24, 30, 40, 30, 40, 20]), ...pe([40, 40, 120, 123, 55.3, 40]), ...di([7.8, 5.7, 9.1]) },
    esp: { endo: 8.69, meso: 7.43, ecto: 0.1, adi: 38.89, mus: 29.92, ose: 10.81, adiMus: 1.3, musOse: 2.77, cormico: 0.52, manou: 93, con: 1.38, s6: 196, s8: 250, imc: 37.2, icc: 0.98, ict: 0.71 },
  },
]

const cerca = (real: number | null, esperado: number, tol: number, etiqueta: string) => {
  assert.notEqual(real, null, `${etiqueta}: es null`)
  assert.ok(Math.abs((real as number) - esperado) <= tol, `${etiqueta}: real ${real} vs esperado ${esperado} (±${tol})`)
}

for (const c of CASOS) {
  test(`golden ${c.nombre}`, () => {
    const r = calcular(c.m, c.pac)
    const e = c.esp
    cerca(r.somatotipo.endo, e.endo, 0.01, 'endo')
    cerca(r.somatotipo.meso, e.meso, 0.01, 'meso')
    cerca(r.somatotipo.ecto, e.ecto, 0.01, 'ecto')
    assert.ok(r.tejidos)
    cerca(r.tejidos!.adiposo, e.adi, 0.01, 'adiposo')
    cerca(r.tejidos!.muscular, e.mus, 0.01, 'muscular')
    cerca(r.tejidos!.oseo, e.ose, 0.01, 'óseo')
    cerca(r.indices.adiposoMuscular, e.adiMus, 0.01, 'adiposo/muscular')
    cerca(r.indices.musculoOseo, e.musOse, 0.01, 'músculo/óseo')
    cerca(r.indices.cormico, e.cormico, 0.01, 'córmico')
    cerca(r.indices.manouvrier, e.manou, 0.5, 'Manouvrier')
    cerca(r.salud.conicidad, e.con, 0.01, 'conicidad')
    cerca(r.sumatorias.s6, e.s6, 0.01, 'Σ6')
    cerca(r.sumatorias.s8, e.s8, 0.01, 'Σ8')
    cerca(r.salud.imc, e.imc, 0.05, 'IMC')
    cerca(r.salud.cinturaCadera, e.icc, 0.01, 'cintura/cadera')
    cerca(r.salud.cinturaTalla, e.ict, 0.01, 'cintura/talla')
    assert.deepEqual(r.faltan, {}, 'no debe faltar ningún dato')
  })
}

test('residual = masa − (adiposo + muscular + óseo)', () => {
  const c = CASOS[0]
  const r = calcular(c.m, c.pac)
  cerca(r.tejidos!.residual, 69.7 - (24.95 + 25.03 + 9.64), 0.03, 'residual Agustín')
})

test('categorías: músculo/óseo por sexo y límites de las 5 zonas', () => {
  assert.equal(calcular(CASOS[0].m, CASOS[0].pac).indices.musculoOseoCategoria, 'Medio') // M 2,60
  assert.equal(calcular(CASOS[1].m, CASOS[1].pac).indices.musculoOseoCategoria, 'Medio') // F 2,36
  assert.equal(calcular(CASOS[2].m, CASOS[2].pac).indices.musculoOseoCategoria, 'Medio') // F 2,25
  assert.equal(calcular(CASOS[3].m, CASOS[3].pac).indices.musculoOseoCategoria, 'Medio') // M 2,77
  assert.equal(categoriaMusculoOseo(2.0, 'F'), 'Muy bajo')
  assert.equal(categoriaMusculoOseo(2.01, 'F'), 'Bajo')
  assert.equal(categoriaMusculoOseo(2.96, 'F'), 'Muy alto')
  assert.equal(categoriaMusculoOseo(2.5, 'M'), 'Medio') // mismo valor, otra categoría que en F
  assert.equal(categoriaMusculoOseo(2.5, 'F'), 'Medio')
  assert.equal(categoriaMusculoOseo(2.34, 'F'), 'Medio')
  assert.equal(categoriaMusculoOseo(2.34, 'M'), 'Bajo')
})

test('sexo null: no asume M — IMC/Σ6/Σ8/somatotipo se calculan igual, músculo-óseo queda null', () => {
  const c = CASOS[0]
  const r = calcular(c.m, { sexo: null, edad: c.pac.edad })
  cerca(r.salud.imc, c.esp.imc, 0.05, 'IMC con sexo null')
  cerca(r.sumatorias.s6, c.esp.s6, 0.01, 'Σ6 con sexo null')
  cerca(r.sumatorias.s8, c.esp.s8, 0.01, 'Σ8 con sexo null')
  cerca(r.somatotipo.endo, c.esp.endo, 0.01, 'endo con sexo null')
  cerca(r.somatotipo.meso, c.esp.meso, 0.01, 'meso con sexo null')
  cerca(r.somatotipo.ecto, c.esp.ecto, 0.01, 'ecto con sexo null')
  assert.equal(r.tejidos?.muscular, null)
  assert.equal(r.indices.musculoOseo, null)
  assert.equal(r.indices.musculoOseoCategoria, null)
  assert.ok(r.faltan.muscular?.includes('sexo'))
})

test('edad null: no asume adulto — IMC/Σ6/Σ8/somatotipo se calculan igual, tejidos queda null con \'edad\' en faltan', () => {
  const c = CASOS[0]
  const r = calcular(c.m, { sexo: c.pac.sexo, edad: null })
  cerca(r.salud.imc, c.esp.imc, 0.05, 'IMC con edad null')
  cerca(r.sumatorias.s6, c.esp.s6, 0.01, 'Σ6 con edad null')
  cerca(r.sumatorias.s8, c.esp.s8, 0.01, 'Σ8 con edad null')
  cerca(r.somatotipo.endo, c.esp.endo, 0.01, 'endo con edad null')
  cerca(r.somatotipo.meso, c.esp.meso, 0.01, 'meso con edad null')
  cerca(r.somatotipo.ecto, c.esp.ecto, 0.01, 'ecto con edad null')
  assert.equal(r.esAdulto, false)
  assert.equal(r.tejidos, null)
  assert.equal(r.indices.musculoOseo, null)
  assert.equal(r.indices.musculoOseoCategoria, null)
  assert.ok(r.faltan.adiposo?.includes('edad'))
  assert.ok(r.faltan.muscular?.includes('edad'))
  assert.ok(r.faltan.oseo?.includes('edad'))
  assert.ok(r.faltan.residual?.includes('edad'))
})

test('menor de edad legítimo (edad conocida, < 20): sin tejidos, pero sin \'faltan\' espurio', () => {
  const c = CASOS[0]
  const r = calcular(c.m, { sexo: c.pac.sexo, edad: 15 })
  assert.equal(r.esAdulto, false)
  assert.equal(r.tejidos, null)
  assert.equal(r.faltan.adiposo, undefined)
  assert.equal(r.faltan.muscular, undefined)
  assert.equal(r.faltan.oseo, undefined)
  assert.equal(r.faltan.residual, undefined)
})

test('proporciones: categorías', () => {
  assert.equal(categoriaCormico(0.5), 'braquicórmico')
  assert.equal(categoriaCormico(0.52), 'metricórmico')
  assert.equal(categoriaCormico(0.56), 'macrocórmico')
  assert.equal(categoriaManouvrier(79), 'miembros inferiores cortos')
  assert.equal(categoriaManouvrier(98), 'miembros inferiores largos')
})

test('envergadura relativa redondeada a 2 decimales', () => {
  const r = calcular(CASOS[0].m, CASOS[0].pac) // 164,5/166 = 0,991 → 0,99
  assert.equal(r.indices.envergaduraRelativa, 0.99)
  const l = calcular(CASOS[2].m, CASOS[2].pac) // 157/157 = 1,00
  assert.equal(l.indices.envergaduraRelativa, 1)
})

test('datos faltantes: no inventa valores y dice qué falta', () => {
  const c = CASOS[0]
  const r = calcular({ ...c.m, femur: null }, c.pac)
  assert.equal(r.tejidos!.oseo, null)
  assert.equal(r.tejidos!.residual, null)
  assert.equal(r.indices.musculoOseo, null)
  assert.equal(r.somatotipo.meso, null)
  assert.equal(r.somatotipo.y, null)
  assert.ok(r.faltan.oseo.includes('diámetro fémur'))
  assert.ok(r.faltan.meso.includes('diámetro fémur'))
  // lo que no depende del fémur sigue calculándose
  assert.notEqual(r.somatotipo.endo, null)
  assert.notEqual(r.tejidos!.adiposo, null)
})

test('menores de 18: sin composición tisular ni clasificación de IMC; sí somatotipo, Σ y proporciones', () => {
  const c = CASOS[0]
  const r = calcular(c.m, { sexo: 'M', edad: 16 })
  assert.equal(r.esAdulto, false)
  assert.equal(r.tejidos, null)
  assert.equal(r.indices.musculoOseo, null)
  assert.equal(r.indices.musculoOseoCategoria, null)
  assert.equal(r.salud.imcClasificacion, null)
  cerca(r.salud.imc, 25.3, 0.05, 'IMC')
  cerca(r.somatotipo.endo, 5.59, 0.01, 'endo')
  cerca(r.sumatorias.s6, 121, 0.01, 'Σ6')
  cerca(r.indices.cormico, 0.5, 0.01, 'córmico')
})

test('registro vacío: todo null, sin errores', () => {
  const r = calcular({}, { sexo: 'F', edad: 30 })
  assert.equal(r.sumatorias.s6, null)
  assert.equal(r.salud.imc, null)
  assert.equal(r.somatotipo.endo, null)
  assert.ok(Object.keys(r.faltan).length > 0)
})

test('Z-score Phantom: talla del phantom da Z = (v − p)/s', () => {
  cerca(zPhantom('cintura', 71.91 + 4.45, 170.18), 1, 1e-9, 'Z cintura')
  assert.equal(zPhantom('cintura', null, 170), null)
  assert.equal(zPhantom('cintura', 80, null), null)
})

test('redondear', () => {
  assert.equal(redondear(1.005, 2), 1.01)
  assert.equal(redondear(null), null)
})
