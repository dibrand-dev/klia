// Migración piloto enpeso → KLIA: UNA paciente (Veronica Valega).
// --dry-run (default): lee scripts/migracion-enpeso/_data/veronica/*.json,
//   construye los payloads y los escribe en
//   scripts/migracion-enpeso/_data/payload.json. No escribe en Supabase.
// --apply: lee ese mismo payload.json ya generado e inserta en Supabase
//   (orden paciente → nota → registros, idempotente).
//
// Columnas enpeso_id (pacientes, integer) y enpeso_consulta_id
// (registros_antropometricos, integer) + índices únicos (terapeuta_id,
// enpeso_id) / (terapeuta_id, enpeso_consulta_id) ya existen en producción —
// no se corre ningún ALTER TABLE desde este script.

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TERAPEUTA_ID = 'e4998c82-39e9-4376-aaf8-f08d04e0d0ad'
const DIR_DATA = path.join(import.meta.dirname, '_data', 'veronica')
const PAYLOAD_PATH = path.join(import.meta.dirname, '_data', 'payload.json')

const MODO_APPLY = process.argv.includes('--apply')

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizar(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function vacioANull(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

// 0 o vacío → null (nunca 0), para los campos numéricos de antropometría.
function numeroOVacioANull(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return null
  return n
}

// Pac_FechaNac / Con_Fecha pueden venir como ISO, DD/MM/YYYY o DD-MM-YYYY —
// se normaliza a YYYY-MM-DD sin asumir nada que no esté en el string.
function aFechaISO(v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  console.warn(`Fecha con formato no reconocido, se deja como vino: "${s}"`)
  return s
}

function mapSexoGenero(pacSexo) {
  const n = normalizar(pacSexo)
  if (n === 'f' || n === 'femenino' || n === 'fem') return 'Femenino'
  if (n === 'm' || n === 'masculino' || n === 'masc') return 'Masculino'
  return pacSexo ?? null
}

async function leerJson(nombre) {
  const archivo = path.join(DIR_DATA, `${nombre}.json`)
  const raw = await readFile(archivo, 'utf8')
  return JSON.parse(raw)
}

// ── Mapeo de campos de antropometría (MCo_*/PCo_*/Ant_*) ──────────────────
// Keyword matching sobre los nombres reales de campo — nunca sobre valores.
// Si una categoría (cintura/cadera/etc.) tiene 0 o 2+ candidatos, no se
// mapea: queda en notas y se avisa, en vez de adivinar.
const CATEGORIAS = {
  cintura: ['cintura'],
  cadera: ['cadera'],
  perimetro_brazo: ['brazo'],
  perimetro_pierna: ['pierna'],
  pliegue_tricipital: ['tricip'],
  pliegue_subescapular: ['subescap'],
  pliegue_suprailiaco: ['suprail', 'supra_iliaco', 'supra iliaco'],
}

function construirMapeoAntropometria(camposMCoPCo) {
  const mapeo = {} // columna → campo enpeso
  const ambiguos = []
  const sinMapear = [...camposMCoPCo]

  for (const [columna, keywords] of Object.entries(CATEGORIAS)) {
    const candidatos = camposMCoPCo.filter((campo) =>
      keywords.some((kw) => normalizar(campo).includes(normalizar(kw)))
    )
    if (candidatos.length === 1) {
      mapeo[columna] = candidatos[0]
      const i = sinMapear.indexOf(candidatos[0])
      if (i >= 0) sinMapear.splice(i, 1)
    } else if (candidatos.length > 1) {
      ambiguos.push({ columna, candidatos })
    }
    // 0 candidatos: la columna queda null para esa consulta, sin avisar
    // (no todos los MCo_*/PCo_* van a existir siempre).
  }

  return { mapeo, ambiguos, sinMapear }
}

// ── 1. Cargar datos crudos ─────────────────────────────────────────────────

async function cargarDatos() {
  const [pacienteRaw, patologicos, habitos, consultas, planes] = await Promise.all([
    leerJson('pacientes-only'),
    leerJson('patologicos'),
    leerJson('habitos'),
    leerJson('consultas'),
    leerJson('planes'),
  ])
  const paciente = Array.isArray(pacienteRaw) ? pacienteRaw[0] : pacienteRaw
  const listaConsultas = Array.isArray(consultas) ? consultas : (consultas.data ?? [])
  return { paciente, patologicos, habitos, listaConsultas, planes }
}

// ── 2. Payload de pacientes ────────────────────────────────────────────────

function construirPayloadPaciente(p) {
  const telefono = vacioANull(p.Pac_Cel) ?? (p.CodArea || p.Pac_Tel ? `${p.CodArea ?? ''}${p.Pac_Tel ?? ''}` : null)

  return {
    terapeuta_id: TERAPEUTA_ID,
    nombre: p.Pac_Nombre,
    apellido: p.Pac_Apellido,
    genero: mapSexoGenero(p.Pac_Sexo),
    sexo: mapSexoGenero(p.Pac_Sexo),
    fecha_nacimiento: aFechaISO(p.Pac_FechaNac),
    email: vacioANull(p.Pac_Email),
    telefono: vacioANull(telefono),
    dni: vacioANull(p.Pac_Documento),
    domicilio: vacioANull(p.Pac_Domicilio ?? p.Pac_domicilio),
    ocupacion: vacioANull(p.Pac_Profesion),
    motivo_consulta: vacioANull(p.Pac_motivo ?? p.Pac_Motivo),
    obra_social: vacioANull(p.Pac_ObraSocial ?? p.Pac_obra_social),
    activo: true,
    enpeso_id: Number(p.Pac_ID ?? p.id),
    // fecha_inicio_tratamiento se completa en construirPayloadCompleto() con
    // la fecha de la primera consulta.
  }
}

// ── 3. Nota clínica única ──────────────────────────────────────────────────

function nombreLegible(campo) {
  return campo
    .replace(/^Pat_H_/, '')
    .replace(/^Pat_/, '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function construirNotaClinica({ patologicos, habitos, listaConsultas }) {
  const partes = []
  partes.push('<h2>Historial migrado desde enpeso</h2>')

  // Antecedentes: flags Pat_*/Pat_H_* en 1, texto libre, alergias.
  const antecedentesPartes = []
  const flagsActivos = Object.entries(patologicos ?? {})
    .filter(([k, v]) => /^Pat_(H_)?/.test(k) && (v === 1 || v === true || v === '1'))
    .map(([k]) => nombreLegible(k))
  if (flagsActivos.length > 0) {
    antecedentesPartes.push(`<p><b>Antecedentes marcados:</b> ${flagsActivos.join(', ')}</p>`)
  }
  const textoLibreAntecedentes = vacioANull(patologicos?.Pat_Texto ?? patologicos?.Pat_Observaciones)
  if (textoLibreAntecedentes) {
    antecedentesPartes.push(`<p>${textoLibreAntecedentes}</p>`)
  }
  const alergias = vacioANull(patologicos?.Pat_Alergias)
  if (alergias) {
    antecedentesPartes.push(`<p><b>Alergias:</b> ${alergias}</p>`)
  }
  if (antecedentesPartes.length > 0) {
    partes.push('<h3>Antecedentes</h3>', ...antecedentesPartes)
  }

  // Hábitos: campos Hab_* con valor.
  const habitosConValor = Object.entries(habitos ?? {})
    .filter(([k, v]) => k.startsWith('Hab_') && vacioANull(v) !== null)
    .map(([k, v]) => `${nombreLegible(k.replace(/^Hab_/, 'Pat_'))}: ${v}`)
  if (habitosConValor.length > 0) {
    partes.push('<h3>Hábitos</h3>', `<p>${habitosConValor.join('<br>')}</p>`)
  }

  // Resumen de evolución: peso inicial/último con fechas + diferencia.
  const conFecha = listaConsultas
    .map((c) => ({ ...c, _fecha: aFechaISO(c.Con_Fecha) }))
    .filter((c) => c._fecha && numeroOVacioANull(c.Ant_Peso) !== null)
    .sort((a, b) => a._fecha.localeCompare(b._fecha))
  if (conFecha.length > 0) {
    const primera = conFecha[0]
    const ultima = conFecha[conFecha.length - 1]
    const pesoInicial = numeroOVacioANull(primera.Ant_Peso)
    const pesoFinal = numeroOVacioANull(ultima.Ant_Peso)
    let texto = `Peso inicial: ${pesoInicial} kg (${primera._fecha}).`
    if (conFecha.length > 1) {
      texto += ` Peso último: ${pesoFinal} kg (${ultima._fecha}).`
      if (pesoInicial !== null && pesoFinal !== null) {
        const diff = (pesoFinal - pesoInicial).toFixed(1)
        texto += ` Diferencia: ${diff > 0 ? '+' : ''}${diff} kg.`
      }
    }
    partes.push('<h3>Resumen de evolución</h3>', `<p>${texto}</p>`)
  }

  return {
    terapeuta_id: TERAPEUTA_ID,
    fecha: new Date().toISOString().slice(0, 10),
    contenido: partes.join('\n'),
    borrador: false,
    // paciente_id se completa en construirPayloadCompleto() una vez
    // resuelto/insertado el paciente.
  }
}

// ── 4. Registros antropométricos ───────────────────────────────────────────

function construirRegistrosAntropometricos(listaConsultas) {
  if (listaConsultas.length === 0) {
    return { registros: [], mapeoInfo: null }
  }

  const camposEjemplo = Object.keys(listaConsultas[0])
  const camposMCoPCo = camposEjemplo.filter((c) => /^(MCo_|PCo_|Ant_)/.test(c))
    .filter((c) => !['Ant_Peso', 'Ant_Talla', 'Ant_Grasa'].includes(c))

  console.log('\nCampos MCo_*/PCo_*/Ant_* encontrados en listado-consultas:')
  console.log(camposMCoPCo.join(', ') || '(ninguno)')

  const { mapeo, ambiguos, sinMapear } = construirMapeoAntropometria(camposMCoPCo)

  console.log('\nTabla de mapeo propuesta:')
  for (const [columna, campo] of Object.entries(mapeo)) {
    console.log(`  ${columna.padEnd(22)} ← ${campo}`)
  }
  if (ambiguos.length > 0) {
    console.log('\n⚠️  Mapeos ambiguos — NO se adivinaron, van a notas:')
    for (const { columna, candidatos } of ambiguos) {
      console.log(`  ${columna}: ${candidatos.join(', ')}`)
    }
  }
  if (sinMapear.length > 0) {
    console.log('\nSin columna propia (van a notas): ' + sinMapear.join(', '))
  }

  const columnaPorCampo = new Map(Object.entries(mapeo).map(([col, campo]) => [campo, col]))
  const camposANotas = [
    ...sinMapear,
    ...ambiguos.flatMap((a) => a.candidatos),
  ]

  const registros = listaConsultas.map((c) => {
    const notasExtra = camposANotas
      .map((campo) => {
        const v = numeroOVacioANull(c[campo])
        return v !== null ? `${campo}: ${v}` : null
      })
      .filter(Boolean)

    const registro = {
      terapeuta_id: TERAPEUTA_ID,
      fecha: aFechaISO(c.Con_Fecha),
      peso: numeroOVacioANull(c.Ant_Peso),
      altura: numeroOVacioANull(c.Ant_Talla),
      cintura: mapeo.cintura ? numeroOVacioANull(c[mapeo.cintura]) : null,
      cadera: mapeo.cadera ? numeroOVacioANull(c[mapeo.cadera]) : null,
      perimetro_brazo: mapeo.perimetro_brazo ? numeroOVacioANull(c[mapeo.perimetro_brazo]) : null,
      perimetro_pierna: mapeo.perimetro_pierna ? numeroOVacioANull(c[mapeo.perimetro_pierna]) : null,
      pliegue_tricipital: mapeo.pliegue_tricipital ? numeroOVacioANull(c[mapeo.pliegue_tricipital]) : null,
      pliegue_subescapular: mapeo.pliegue_subescapular ? numeroOVacioANull(c[mapeo.pliegue_subescapular]) : null,
      pliegue_suprailiaco: mapeo.pliegue_suprailiaco ? numeroOVacioANull(c[mapeo.pliegue_suprailiaco]) : null,
      porcentaje_grasa: numeroOVacioANull(c.Ant_Grasa),
      notas: notasExtra.length > 0 ? notasExtra.join('\n') : null,
      enpeso_consulta_id: Number(c.Con_ID),
      // paciente_id se completa en construirPayloadCompleto().
    }
    return registro
  })

  return { registros, mapeoInfo: { mapeo, ambiguos, sinMapear } }
}

// ── 5. Armado del payload completo (dry-run) ────────────────────────────────

async function construirPayload() {
  const { paciente, patologicos, habitos, listaConsultas } = await cargarDatos()

  const payloadPaciente = construirPayloadPaciente(paciente)

  const conFechaValida = listaConsultas
    .map((c) => aFechaISO(c.Con_Fecha))
    .filter(Boolean)
    .sort()
  if (conFechaValida.length > 0) {
    payloadPaciente.fecha_inicio_tratamiento = conFechaValida[0]
  }

  const payloadNota = construirNotaClinica({ patologicos, habitos, listaConsultas })
  const { registros, mapeoInfo } = construirRegistrosAntropometricos(listaConsultas)

  return { paciente: payloadPaciente, nota: payloadNota, registros, mapeoInfo }
}

async function dryRun() {
  const payload = await construirPayload()

  console.log('\n=== Payload paciente ===')
  console.log(JSON.stringify(payload.paciente, null, 2))

  console.log('\n=== Payload nota clínica ===')
  console.log(JSON.stringify(payload.nota, null, 2))

  console.log(`\n=== Registros antropométricos: ${payload.registros.length} ===`)
  console.log(JSON.stringify(payload.registros.slice(0, 2), null, 2))

  await writeFile(PAYLOAD_PATH, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\nPayload completo escrito en ${PAYLOAD_PATH}`)
  console.log('No se escribió nada en Supabase (dry-run). Revisar y confirmar antes de --apply.')
}

// ── 6. Import real ──────────────────────────────────────────────────────────

async function aplicar() {
  const { createClient } = await import('@supabase/supabase-js')

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY en el entorno. Abortando.')
    process.exit(1)
  }

  const raw = await readFile(PAYLOAD_PATH, 'utf8')
  const payload = JSON.parse(raw)
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Idempotencia: por enpeso_id primero; si no hay fila con ese enpeso_id,
  // fallback por nombre+apellido normalizado + fecha_nacimiento (posible
  // duplicado — no se inserta, se reporta).
  const { data: existentePorEnpesoId } = await db
    .from('pacientes')
    .select('id')
    .eq('terapeuta_id', TERAPEUTA_ID)
    .eq('enpeso_id', payload.paciente.enpeso_id)
    .maybeSingle()

  let pacienteId
  if (existentePorEnpesoId) {
    console.log(`Paciente ya existe con enpeso_id=${payload.paciente.enpeso_id} → id=${existentePorEnpesoId.id}. No se inserta de nuevo.`)
    pacienteId = existentePorEnpesoId.id
  } else {
    const { data: candidatosDuplicado } = await db
      .from('pacientes')
      .select('id, nombre, apellido, fecha_nacimiento')
      .eq('terapeuta_id', TERAPEUTA_ID)
      .ilike('nombre', payload.paciente.nombre)
      .ilike('apellido', payload.paciente.apellido)

    const duplicadoPosible = (candidatosDuplicado ?? []).find(
      (c) => c.fecha_nacimiento === payload.paciente.fecha_nacimiento
    )

    if (duplicadoPosible) {
      console.error(`Posible duplicado: ya existe paciente id=${duplicadoPosible.id} con mismo nombre+apellido+fecha_nacimiento pero sin este enpeso_id. NO se inserta. Reportar y decidir a mano.`)
      process.exit(1)
    }

    const { data: nuevoPaciente, error: errPaciente } = await db
      .from('pacientes')
      .insert(payload.paciente)
      .select('id')
      .single()

    if (errPaciente || !nuevoPaciente) {
      console.error('Error insertando paciente. No se insertó nada más.', errPaciente)
      process.exit(1)
    }
    pacienteId = nuevoPaciente.id
    console.log(`Paciente insertado: id=${pacienteId}`)
  }

  const { data: notaExistente } = await db
    .from('notas_clinicas')
    .select('id')
    .eq('terapeuta_id', TERAPEUTA_ID)
    .eq('paciente_id', pacienteId)
    .eq('contenido', payload.nota.contenido)
    .maybeSingle()

  if (notaExistente) {
    console.log(`Nota clínica ya existe (id=${notaExistente.id}). No se inserta de nuevo.`)
  } else {
    const { error: errNota } = await db
      .from('notas_clinicas')
      .insert({ ...payload.nota, paciente_id: pacienteId })
    if (errNota) {
      console.error(`Paciente insertado (id=${pacienteId}) pero falló la nota clínica. Quedó insertado solo el paciente.`, errNota)
      process.exit(1)
    }
    console.log('Nota clínica insertada.')
  }

  let insertados = 0
  for (const registro of payload.registros) {
    const { data: existente } = await db
      .from('registros_antropometricos')
      .select('id')
      .eq('terapeuta_id', TERAPEUTA_ID)
      .eq('enpeso_consulta_id', registro.enpeso_consulta_id)
      .maybeSingle()

    const fila = { ...registro, paciente_id: pacienteId }

    if (existente) {
      const { error: errUpdate } = await db
        .from('registros_antropometricos')
        .update(fila)
        .eq('id', existente.id)
      if (errUpdate) {
        console.error(`Paciente id=${pacienteId}, nota OK, ${insertados} registro(s) ya insertados. Falló update de enpeso_consulta_id=${registro.enpeso_consulta_id}.`, errUpdate)
        process.exit(1)
      }
    } else {
      const { error: errInsert } = await db
        .from('registros_antropometricos')
        .insert(fila)
      if (errInsert) {
        console.error(`Paciente id=${pacienteId}, nota OK, ${insertados} registro(s) ya insertados. Falló insert de enpeso_consulta_id=${registro.enpeso_consulta_id}.`, errInsert)
        process.exit(1)
      }
    }
    insertados++
  }
  console.log(`Registros antropométricos procesados (insert/update): ${insertados}`)

  console.log('\n=== Verificación ===')
  const { count: countPacientes } = await db
    .from('pacientes').select('id', { count: 'exact', head: true }).eq('id', pacienteId)
  const { count: countNotas } = await db
    .from('notas_clinicas').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId)
  const { count: countRegistros } = await db
    .from('registros_antropometricos').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId)
  console.log(`pacientes: ${countPacientes} | notas_clinicas: ${countNotas} | registros_antropometricos: ${countRegistros}`)
}

// ── Main ─────────────────────────────────────────────────────────────────

if (MODO_APPLY) {
  aplicar().catch((err) => {
    console.error('Error en --apply:', err.message)
    process.exit(1)
  })
} else {
  dryRun().catch((err) => {
    console.error('Error en dry-run:', err.message)
    process.exit(1)
  })
}
