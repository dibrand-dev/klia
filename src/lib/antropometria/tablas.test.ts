// Tests de las tablas de datos (textos del somatotipo y cintura/cadera por sexo/edad).
// Corre con: npx tsx --test src/lib/antropometria/tablas.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEXTOS_SOMATOTIPO, ACLARACION_ESCALA_SOMATOTIPO, type ComponenteSomatotipo, type NivelSomatotipo } from './textos-somatotipo'
import { categoriaCinturaCadera, TABLA_CINTURA_CADERA, CORTE_OMS_CINTURA_CADERA } from './tabla-cintura-cadera'
import { TEXTOS_CORMICO, TEXTOS_MANOUVRIER, TEXTOS_ENVERGADURA } from './textos-proporcionalidad'
import { categoriaCormico, categoriaManouvrier, categoriaEnvergadura } from './calculos'

test('Natalia: mujer 50,96 años, cintura/cadera 0,784 → moderado', () => {
  const r = categoriaCinturaCadera('F', 50.96, 0.784)
  assert.ok(r)
  assert.equal(r!.categoria, 'moderado')
  assert.equal(r!.decadaDesde, 50)
  assert.equal(r!.decadaHasta, 59)
})

test('límites mujer 20–29: 0,71 → moderado, 0,70 → bajo, 0,83 → muy_alto', () => {
  assert.equal(categoriaCinturaCadera('F', 25, 0.71)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 25, 0.70)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('F', 25, 0.83)!.categoria, 'muy_alto')
})

test('límites de cada década y sexo', () => {
  // Mujeres
  assert.equal(categoriaCinturaCadera('F', 35, 0.72)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 35, 0.78)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 35, 0.79)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 35, 0.84)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 35, 0.85)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('F', 45, 0.73)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 45, 0.72)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('F', 45, 0.87)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 45, 0.88)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('F', 55, 0.74)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 55, 0.88)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 55, 0.89)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('F', 65, 0.76)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('F', 65, 0.75)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('F', 65, 0.90)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 65, 0.91)!.categoria, 'muy_alto')

  // Hombres
  assert.equal(categoriaCinturaCadera('M', 25, 0.83)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('M', 25, 0.82)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('M', 25, 0.94)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('M', 25, 0.95)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('M', 35, 0.84)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('M', 35, 0.96)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('M', 35, 0.97)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('M', 45, 0.88)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('M', 45, 0.87)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('M', 45, 1.00)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('M', 45, 1.01)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('M', 55, 0.90)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('M', 55, 1.02)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('M', 55, 1.03)!.categoria, 'muy_alto')

  assert.equal(categoriaCinturaCadera('M', 65, 0.91)!.categoria, 'moderado')
  assert.equal(categoriaCinturaCadera('M', 65, 0.90)!.categoria, 'bajo')
  assert.equal(categoriaCinturaCadera('M', 65, 1.03)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('M', 65, 1.04)!.categoria, 'muy_alto')
})

test('edad fuera de 20–69 (usando Math.floor): 19 y 70 → null', () => {
  assert.equal(categoriaCinturaCadera('F', 19, 0.75), null)
  assert.equal(categoriaCinturaCadera('F', 19.99, 0.75), null) // floor(19.99) = 19
  assert.equal(categoriaCinturaCadera('M', 70, 0.9), null)
  assert.equal(categoriaCinturaCadera('F', 20, 0.75)!.categoria, 'moderado') // floor(20) = 20, límite inferior válido
  assert.equal(categoriaCinturaCadera('M', 69.9, 0.9)!.decadaHasta, 69) // floor(69.9) = 69, límite superior válido
})

test('redondeo a 2 decimales antes de clasificar', () => {
  // 0,715 redondea a 0,72 (sube de rango en mujer 20–29: 0,71 ya es moderado, pero 0,714999 debería
  // redondear a 0,71 y seguir siendo moderado; 0,715 redondea a 0,72 y sigue moderado también,
  // así que probamos un caso que cruza el límite alto/muy_alto: 0,824999 → 0,82 → alto.
  assert.equal(categoriaCinturaCadera('F', 25, 0.824999)!.categoria, 'alto')
  assert.equal(categoriaCinturaCadera('F', 25, 0.825)!.categoria, 'muy_alto')
})

test('corte OMS de respaldo exportado', () => {
  assert.equal(CORTE_OMS_CINTURA_CADERA.F, 0.85)
  assert.equal(CORTE_OMS_CINTURA_CADERA.M, 0.9)
})

test('tabla cintura/cadera cubre las 5 décadas para ambos sexos', () => {
  assert.equal(TABLA_CINTURA_CADERA.F.length, 5)
  assert.equal(TABLA_CINTURA_CADERA.M.length, 5)
})

test('todas las claves de textos del somatotipo existen y no están vacías', () => {
  const componentes: ComponenteSomatotipo[] = ['endo', 'meso', 'ecto']
  const niveles: NivelSomatotipo[] = ['bajo', 'moderado', 'alto', 'muy alto']
  for (const c of componentes) {
    assert.ok(TEXTOS_SOMATOTIPO[c], `falta el componente ${c}`)
    for (const n of niveles) {
      const texto = TEXTOS_SOMATOTIPO[c][n]
      assert.equal(typeof texto, 'string', `${c}/${n} no es string`)
      assert.ok(texto.trim().length > 0, `${c}/${n} está vacío`)
    }
  }
  assert.ok(ACLARACION_ESCALA_SOMATOTIPO.trim().length > 0)
})

test('textos de proporcionalidad: todas las keys que devuelven las funciones de categoría tienen texto', () => {
  for (const v of [0.4, 0.52, 0.6]) assert.ok(TEXTOS_CORMICO[categoriaCormico(v)].etiqueta)
  for (const v of [80, 87, 95]) assert.ok(TEXTOS_MANOUVRIER[categoriaManouvrier(v)].etiqueta)
  for (const v of [0.9, 1, 1.1]) assert.ok(TEXTOS_ENVERGADURA[categoriaEnvergadura(v)].etiqueta)
})
