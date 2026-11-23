// Corre con: npx tsx --test src/lib/facturacion/aviso.test.ts
// db y enviarEmail van inyectados/mockeados — sin tocar Supabase ni Brevo reales.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avisarDatosFacturacion } from './aviso'

interface ProfileFake {
  cuit: string | null
  facturacion_aviso_enviado_at: string | null
  nombre: string | null
  email: string | null
}

function crearDbFake(profileInicial: ProfileFake) {
  const estado: ProfileFake = { ...profileInicial }
  let pendingPatch: Record<string, unknown> | null = null
  let filtros: { cuitNull: boolean; avisoNull: boolean } = { cuitNull: false, avisoNull: false }

  const builder = {
    update(patch: Record<string, unknown>) {
      pendingPatch = patch
      filtros = { cuitNull: false, avisoNull: false }
      return builder
    },
    eq() {
      return builder
    },
    is(col: string) {
      if (col === 'cuit') filtros.cuitNull = true
      if (col === 'facturacion_aviso_enviado_at') filtros.avisoNull = true
      return builder
    },
    select() {
      return builder
    },
    async maybeSingle() {
      const condMatch = (!filtros.cuitNull || estado.cuit === null) && (!filtros.avisoNull || estado.facturacion_aviso_enviado_at === null)
      if (!condMatch) return { data: null, error: null }
      Object.assign(estado, pendingPatch)
      return { data: { nombre: estado.nombre, email: estado.email }, error: null }
    },
    // Camino de reversión: se awaitea el builder directo, sin pasar por maybeSingle().
    then(resolve: (v: { data: null; error: null }) => void) {
      Object.assign(estado, pendingPatch)
      resolve({ data: null, error: null })
    },
  }

  return {
    db: { from: () => builder } as unknown as Parameters<typeof avisarDatosFacturacion>[0],
    estado,
  }
}

function enviarEmailFake(resultado: 'ok' | 'falla') {
  const llamadas: unknown[] = []
  return {
    llamadas,
    fn: (async (args: unknown) => {
      llamadas.push(args)
      if (resultado === 'falla') throw new Error('Brevo caído')
      return { messageId: 'msg-1' }
    }) as Parameters<typeof avisarDatosFacturacion>[2]['enviarEmail'],
  }
}

test('sin cuit y sin aviso previo → envía una vez y marca', async () => {
  const { db, estado } = crearDbFake({ cuit: null, facturacion_aviso_enviado_at: null, nombre: 'Ana', email: 'ana@x.com' })
  const { llamadas, fn } = enviarEmailFake('ok')
  await avisarDatosFacturacion(db, 't1', { enviarEmail: fn })
  assert.equal(llamadas.length, 1)
  assert.ok(estado.facturacion_aviso_enviado_at)
})

test('con cuit → no envía', async () => {
  const { db, estado } = crearDbFake({ cuit: '20123456786', facturacion_aviso_enviado_at: null, nombre: 'Ana', email: 'ana@x.com' })
  const { llamadas, fn } = enviarEmailFake('ok')
  await avisarDatosFacturacion(db, 't1', { enviarEmail: fn })
  assert.equal(llamadas.length, 0)
  assert.equal(estado.facturacion_aviso_enviado_at, null)
})

test('con aviso ya enviado → no envía', async () => {
  const { db, estado } = crearDbFake({ cuit: null, facturacion_aviso_enviado_at: '2026-01-01T00:00:00Z', nombre: 'Ana', email: 'ana@x.com' })
  const { llamadas, fn } = enviarEmailFake('ok')
  await avisarDatosFacturacion(db, 't1', { enviarEmail: fn })
  assert.equal(llamadas.length, 0)
  assert.equal(estado.facturacion_aviso_enviado_at, '2026-01-01T00:00:00Z')
})

test('si enviarEmail falla → se revierte la marca y no lanza', async () => {
  const { db, estado } = crearDbFake({ cuit: null, facturacion_aviso_enviado_at: null, nombre: 'Ana', email: 'ana@x.com' })
  const { llamadas, fn } = enviarEmailFake('falla')
  await assert.doesNotReject(avisarDatosFacturacion(db, 't1', { enviarEmail: fn }))
  assert.equal(llamadas.length, 1)
  assert.equal(estado.facturacion_aviso_enviado_at, null)
})

test('sin email → no envía y se revierte', async () => {
  const { db, estado } = crearDbFake({ cuit: null, facturacion_aviso_enviado_at: null, nombre: 'Ana', email: null })
  const { llamadas, fn } = enviarEmailFake('ok')
  await avisarDatosFacturacion(db, 't1', { enviarEmail: fn })
  assert.equal(llamadas.length, 0)
  assert.equal(estado.facturacion_aviso_enviado_at, null)
})
