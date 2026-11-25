import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapQualifications } from './mapear-qualifications'
import type { FhirPractitioner } from '@/types/sisa'

// Fixture con la forma real de la respuesta del Bus para Mili (DNI
// 33404077): matrícula Nacional 9585 (CABA, emitida por el Ministerio de
// Salud de la Nación) + matrícula Provincial 6248 (Buenos Aires, emitida
// por el Colegio de Nutricionistas), ambas habilitadas.
const practitionerMili: FhirPractitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-mili',
  gender: 'female',
  qualification: [
    {
      identifier: [{ value: '9585' }],
      code: { coding: [{ code: 'NUT', display: 'Nutricionista' }] },
      period: { start: '2015-03-10' },
      issuer: { identifier: { value: '10002001110000' }, display: 'Ministerio de Salud de la Nación' },
      extension: [
        { url: 'http://fhir.msal.gob.ar/StructureDefinition/MatriculaHabilitada', valueBoolean: true },
        { url: 'http://fhir.msal.gob.ar/StructureDefinition/JurisdMatricula', valueCoding: { code: 'CABA', display: 'CABA' } },
      ],
    },
    {
      identifier: [{ value: '6248' }],
      code: { coding: [{ code: 'NUT', display: 'Nutricionista' }] },
      period: { start: '2016-07-01' },
      issuer: { identifier: { value: '900123' }, display: 'Colegio de Nutricionistas' },
      extension: [
        { url: 'http://fhir.msal.gob.ar/StructureDefinition/MatriculaHabilitada', valueBoolean: true },
        { url: 'http://fhir.msal.gob.ar/StructureDefinition/JurisdMatricula', valueCoding: { code: 'BA', display: 'Buenos Aires' } },
      ],
    },
  ],
}

test('mapQualifications — Nacional sin provincia, Provincial con provincia, ambas habilitadas', () => {
  const resultado = mapQualifications(practitionerMili)

  assert.equal(resultado.length, 2)

  const nacional = resultado.find((m) => m.numero === '9585')
  assert.ok(nacional)
  assert.equal(nacional.tipo, 'nacional')
  assert.equal(nacional.provincia, null)
  assert.equal(nacional.emisorNombre, 'Ministerio de Salud de la Nación')
  assert.equal(nacional.habilitada, true)

  const provincial = resultado.find((m) => m.numero === '6248')
  assert.ok(provincial)
  assert.equal(provincial.tipo, 'provincial')
  assert.equal(provincial.provincia, 'Buenos Aires')
  assert.equal(provincial.emisorNombre, 'Colegio de Nutricionistas')
  assert.equal(provincial.habilitada, true)
})

test('mapQualifications — sin identifier se descarta la qualification', () => {
  const practitioner: FhirPractitioner = {
    resourceType: 'Practitioner',
    qualification: [
      { code: { coding: [{ display: 'Nutricionista' }] } },
    ],
  }
  assert.equal(mapQualifications(practitioner).length, 0)
})

test('mapQualifications — sin qualifications devuelve array vacío', () => {
  const practitioner: FhirPractitioner = { resourceType: 'Practitioner' }
  assert.deepEqual(mapQualifications(practitioner), [])
})

test('mapQualifications — qualification no habilitada', () => {
  const practitioner: FhirPractitioner = {
    resourceType: 'Practitioner',
    qualification: [
      {
        identifier: [{ value: '111' }],
        issuer: { identifier: { value: '900999' }, display: 'Colegio X' },
        extension: [
          { url: 'http://fhir.msal.gob.ar/StructureDefinition/MatriculaHabilitada', valueBoolean: false },
          { url: 'http://fhir.msal.gob.ar/StructureDefinition/JurisdMatricula', valueCoding: { display: 'Córdoba' } },
        ],
      },
    ],
  }
  const [m] = mapQualifications(practitioner)
  assert.equal(m.habilitada, false)
  assert.equal(m.tipo, 'provincial')
  assert.equal(m.provincia, 'Córdoba')
})
