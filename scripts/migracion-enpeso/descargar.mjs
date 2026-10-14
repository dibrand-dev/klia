// Descarga cruda desde enpeso para UNA paciente (piloto): Veronica Valega.
// No escribe el listado completo a disco ni a consola — solo busca el id de
// esta paciente y descarta el resto en memoria.
//
// Uso: ENPESO_TOKEN=xxx node scripts/migracion-enpeso/descargar.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://api.enpeso.com'
const PAUSA_MS = 400
const DIR_SALIDA = path.join(import.meta.dirname, '_data', 'veronica')

const token = process.env.ENPESO_TOKEN
if (!token) {
  console.error('Falta ENPESO_TOKEN en el entorno. Abortando.')
  process.exit(1)
}

function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Primer intento con el token tal cual; si da 401, reintenta con "Bearer ".
// authModo se cachea después del primer request exitoso para no probar las
// dos formas en cada llamada siguiente.
let authModo = null // 'crudo' | 'bearer'

async function fetchEnpeso(urlPath) {
  const url = `${BASE}${urlPath}`

  async function intentar(modo) {
    const auth = modo === 'bearer' ? `Bearer ${token}` : token
    const res = await fetch(url, { headers: { Authorization: auth } })
    return res
  }

  let res
  if (authModo) {
    res = await intentar(authModo)
  } else {
    res = await intentar('crudo')
    if (res.status === 401) {
      await sleep(PAUSA_MS)
      res = await intentar('bearer')
      if (res.ok) authModo = 'bearer'
    } else if (res.ok) {
      authModo = 'crudo'
    }
  }

  if (!res.ok) {
    throw new Error(`GET ${urlPath} → ${res.status} ${res.statusText}`)
  }

  await sleep(PAUSA_MS)
  return res.json()
}

async function main() {
  console.log('Buscando a Veronica Valega en el listado de pacientes...')
  const listado = await fetchEnpeso('/api/get_list_of_few_patient_data')
  const items = Array.isArray(listado) ? listado : (listado.data ?? listado.pacientes ?? [])

  const coincidencias = items.filter((p) => {
    const nombre = normalizar(p.Pac_Nombre ?? p.nombre)
    const apellido = normalizar(p.Pac_Apellido ?? p.apellido)
    return nombre === 'veronica' && apellido === 'valega'
  })

  if (coincidencias.length !== 1) {
    console.error(`Se esperaba 1 coincidencia de Veronica Valega, se encontraron ${coincidencias.length}. Abortando.`)
    process.exit(1)
  }

  const paciente = coincidencias[0]
  const id = paciente.Pac_ID ?? paciente.id
  if (!id) {
    console.error('La coincidencia encontrada no tiene id. Abortando.')
    process.exit(1)
  }

  console.log('Paciente encontrada. Descargando detalle...')

  await mkdir(DIR_SALIDA, { recursive: true })

  const endpoints = {
    'pacientes-only': `/api/pacientes-only/${id}`,
    'patologicos': `/api/get-patient-patologicos/${id}`,
    'habitos': `/api/get-patient-habits/${id}`,
    'consultas': `/api/listado-consultas/${id}`,
    'planes': `/api/listado-planes-paciente/${id}`,
  }

  for (const [nombreArchivo, urlPath] of Object.entries(endpoints)) {
    const data = await fetchEnpeso(urlPath)
    const archivo = path.join(DIR_SALIDA, `${nombreArchivo}.json`)
    await writeFile(archivo, JSON.stringify(data, null, 2), 'utf8')

    const campos = Array.isArray(data)
      ? (data[0] ? Object.keys(data[0]) : [])
      : Object.keys(data ?? {})
    const cantidad = Array.isArray(data) ? data.length : 1
    console.log(`${nombreArchivo}: ${cantidad} registro(s) — campos: ${campos.join(', ')}`)
  }

  console.log('Descarga completa en scripts/migracion-enpeso/_data/veronica/')
}

main().catch((err) => {
  console.error('Error en la descarga:', err.message)
  process.exit(1)
})
