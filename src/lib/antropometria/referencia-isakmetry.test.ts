// Validación de calcular() contra un reporte real de ISAKMetry (Agustín Giardini,
// 04-07-2026, ISAK nivel 1, perfil restringido). El mismo dataset ya está cubierto
// por el test "golden Agustín" en calculos.test.ts (IMC/Σ6/Σ8/tejidos/índices/salud/
// somatotipo) — este archivo agrega lo que ese test NO cubre: los Z-scores Phantom
// de cada medida individual, de los tejidos y de los perímetros corregidos.
// NO modifica fórmulas ni constantes. Corre con: npx tsx --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcular, zPhantom, type Medidas, type Paciente } from './calculos'

const m: Medidas = {
  masa: 69.7, talla: 166.0, tallaSentado: 83.8, envergadura: 164.5,
  triceps: 19.0, subescapular: 17.5, biceps: 12.5, crestaIliaca: 19.5, supraespinal: 19.0, abdominal: 16.0, muslo: 27.0, pantorrilla: 22.5,
  brazoRelajado: 30.0, brazoContraido: 29.0, cintura: 80.5, cadera: 101.8, musloMedio: 49.5, pierna: 36.5,
  humero: 6.0, biestiloideo: 5.2, femur: 8.9,
}
const pac: Paciente = { sexo: 'M', edad: 23 }

const r = calcular(m, pac)

const TOL_VALOR = 0.01
const TOL_Z = 0.02

const cerca = (real: number | null, esperado: number, tol: number, etiqueta: string) => {
  assert.notEqual(real, null, `${etiqueta}: es null`)
  assert.ok(Math.abs((real as number) - esperado) <= tol, `${etiqueta}: real ${real} vs esperado ${esperado} (±${tol})`)
}

test('ISAKMetry: valores base (IMC, Σ6, Σ8)', () => {
  cerca(r.salud.imc, 25.3, TOL_VALOR, 'IMC')
  cerca(r.sumatorias.s6, 121.0, TOL_VALOR, 'Σ6')
  cerca(r.sumatorias.s8, 153.0, TOL_VALOR, 'Σ8')
})

test('ISAKMetry: Z-score Phantom de medidas básicas', () => {
  cerca(zPhantom('masa', m.masa, m.talla), 1.21, TOL_Z, 'Z masa')
  cerca(zPhantom('tallaSentado', m.tallaSentado, m.talla), -0.89, TOL_Z, 'Z talla sentado')
  cerca(zPhantom('envergadura', m.envergadura, m.talla), -0.50, TOL_Z, 'Z envergadura')
})

test('ISAKMetry: Z-score Phantom de pliegues', () => {
  cerca(zPhantom('triceps', m.triceps, m.talla), 0.91, TOL_Z, 'Z tríceps')
  cerca(zPhantom('subescapular', m.subescapular, m.talla), 0.15, TOL_Z, 'Z subescapular')
  cerca(zPhantom('biceps', m.biceps, m.talla), 2.41, TOL_Z, 'Z bíceps')
  cerca(zPhantom('crestaIliaca', m.crestaIliaca, m.talla), -0.35, TOL_Z, 'Z cresta ilíaca')
  cerca(zPhantom('supraespinal', m.supraespinal, m.talla), 0.91, TOL_Z, 'Z supraespinal')
  cerca(zPhantom('abdominal', m.abdominal, m.talla), -1.16, TOL_Z, 'Z abdominal')
  cerca(zPhantom('muslo', m.muslo, m.talla), 0.08, TOL_Z, 'Z muslo (pliegue)')
  cerca(zPhantom('pantorrilla', m.pantorrilla, m.talla), 1.51, TOL_Z, 'Z pierna (pliegue)')
})

test('ISAKMetry: Z-score Phantom de perímetros', () => {
  cerca(zPhantom('brazoRelajado', m.brazoRelajado, m.talla), 1.66, TOL_Z, 'Z brazo relajado')
  cerca(zPhantom('brazoContraido', m.brazoContraido, m.talla), 0.14, TOL_Z, 'Z brazo contraído')
  cerca(zPhantom('cintura', m.cintura, m.talla), 2.39, TOL_Z, 'Z cintura')
  cerca(zPhantom('cadera', m.cadera, m.talla), 1.74, TOL_Z, 'Z cadera')
  cerca(zPhantom('musloMedio', m.musloMedio, m.talla), -0.54, TOL_Z, 'Z muslo medio')
  cerca(zPhantom('pierna', m.pierna, m.talla), 0.94, TOL_Z, 'Z pierna (perímetro)')
})

test('ISAKMetry: Z-score Phantom de diámetros', () => {
  cerca(zPhantom('humero', m.humero, m.talla), -0.94, TOL_Z, 'Z húmero')
  cerca(zPhantom('biestiloideo', m.biestiloideo, m.talla), 0.43, TOL_Z, 'Z biestiloideo')
  cerca(zPhantom('femur', m.femur, m.talla), -0.82, TOL_Z, 'Z fémur')
})

test('ISAKMetry: tejidos (kg y Z-score)', () => {
  assert.ok(r.tejidos)
  assert.ok(r.tejidosZ)
  cerca(r.tejidos!.adiposo, 24.95, TOL_VALOR, 'adiposo kg')
  cerca(r.tejidosZ!.adiposo, 0.22, TOL_Z, 'Z adiposo')
  cerca(r.tejidos!.muscular, 25.03, TOL_VALOR, 'muscular kg')
  cerca(r.tejidosZ!.muscular, 0.47, TOL_Z, 'Z muscular')
  cerca(r.tejidos!.oseo, 9.64, TOL_VALOR, 'óseo kg')
  cerca(r.tejidosZ!.oseo, -0.07, TOL_Z, 'Z óseo')
  // ISAK nivel 1 no usa el modelo de 5 componentes: no hay tejido residual que testear.
})

test('ISAKMetry: perímetros corregidos (valor y Z-score)', () => {
  cerca(r.corregidos.brazo, 24.03, TOL_VALOR, 'brazo corregido')
  cerca(zPhantom('brazoCorregido', r.corregidos.brazo, m.talla), 1.35, TOL_Z, 'Z brazo corregido')
  cerca(r.corregidos.muslo, 41.02, TOL_VALOR, 'muslo corregido')
  // DIVERGENCIA CONOCIDA con el reporte ISAKMetry de referencia: el reporte muestra -0,54, que
  // coincide con el Z del perímetro de muslo medio SIN corregir (-0,5414, ver assert de abajo).
  // La librería calcula el Z del muslo corregido (41,02 cm) contra el phantom corregido (47,34;
  // DE 3,59): -1,47. Pendiente de confirmación de la nutricionista — no se toca la fórmula ni la
  // constante por esta divergencia.
  cerca(zPhantom('musloCorregido', r.corregidos.muslo, m.talla), -1.47, TOL_Z, 'Z muslo corregido')
  cerca(zPhantom('musloMedio', m.musloMedio, m.talla), -0.54, TOL_Z, 'Z muslo medio sin corregir (coincide con el "-0,54" del reporte)')
  cerca(r.corregidos.pierna, 29.43, TOL_VALOR, 'pierna corregida')
  cerca(zPhantom('piernaCorregida', r.corregidos.pierna, m.talla), -0.02, TOL_Z, 'Z pierna corregida')
})

test('ISAKMetry: índices y categorías', () => {
  cerca(r.indices.adiposoMuscular, 1.00, TOL_VALOR, 'índice adiposo/muscular')
  cerca(r.indices.musculoOseo, 2.60, TOL_VALOR, 'índice músculo/óseo')
  assert.equal(r.indices.musculoOseoCategoria, 'Medio')
  cerca(r.indices.cormico, 0.50, TOL_VALOR, 'córmico')
  cerca(r.indices.manouvrier as number, 98, 0.5, 'Manouvrier')
  cerca(r.indices.envergaduraRelativa, 0.99, TOL_VALOR, 'envergadura relativa')
})

test('ISAKMetry: somatotipo', () => {
  cerca(r.somatotipo.endo, 5.59, TOL_VALOR, 'endo')
  cerca(r.somatotipo.meso, 3.86, TOL_VALOR, 'meso')
  cerca(r.somatotipo.ecto, 1.05, TOL_VALOR, 'ecto')
})

test('ISAKMetry: índices de salud', () => {
  cerca(r.salud.cinturaCadera, 0.79, TOL_VALOR, 'cintura/cadera')
  cerca(r.salud.cinturaTalla, 0.48, TOL_VALOR, 'cintura/talla')
  cerca(r.salud.conicidad, 1.14, TOL_VALOR, 'conicidad')
})
