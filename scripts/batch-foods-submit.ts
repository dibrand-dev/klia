// Batch 1 — genera las imágenes de los 21 alimentos piloto (12 ARGENFOOD +
// 9 OFF) vía la Batch API de Gemini. NO se ejecutó todavía — crea un batch
// job real contra la API (tiene costo), así que corre solo con OK explícito.
// Uso: npx tsx scripts/batch-foods-submit.ts
//
// Resuelve los IDs por nombre+fuente contra la base a la que apunten las
// env vars del entorno (nunca hardcodeados — difieren entre staging y
// producción), y solo arma el JSONL para los que todavía no tengan imagen.
//
// Nota sobre la Batch API: a diferencia de ai.interactions.create() (usado
// en lib/food-images.ts para la generación interactiva, con
// response_format), la Batch API sigue documentada con el formato JSONL
// viejo: { key, request: { contents, generation_config } } con
// generation_config.response_modalities en mayúsculas — confirmado contra
// la doc oficial antes de escribir esto (ver PASO 2). No incluye
// aspect_ratio explícito en el JSONL por no tener confirmación del campo
// exacto en este formato viejo — la relación 1:1 ya está en el texto del
// prompt.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import { construirPromptAlimento, type Presentacion } from '../src/lib/food-images'

interface OverrideManual {
  nombreVisual: string
  presentacion: Presentacion
}

// (nombre, fuente) exactos como están en vademecum_alimentos — mapa de
// "nombre_visual" + presentación para este batch puntual. Para cualquier
// otro alimento fuera de esta lista, construirPromptAlimento usa
// nombre + grupo y deja la presentación a criterio de Gemini.
const BATCH_1: { nombre: string; fuente: string; override: OverrideManual }[] = [
  { nombre: 'Bife', fuente: 'argenfood', override: { nombreVisual: 'un bife de res crudo', presentacion: 'fondo_blanco' } },
  { nombre: 'Bola de lomo', fuente: 'argenfood', override: { nombreVisual: 'bola de lomo, pieza entera cruda', presentacion: 'fondo_blanco' } },
  { nombre: 'Pollo, asado a la parrilla', fuente: 'argenfood', override: { nombreVisual: 'una presa de pollo asada a la parrilla', presentacion: 'plato_blanco' } },
  { nombre: 'Arroz, grano, blanco, pulido, crudo', fuente: 'argenfood', override: { nombreVisual: 'un montoncito de arroz blanco crudo', presentacion: 'fondo_blanco' } },
  { nombre: 'Trigo, pan de salvado', fuente: 'argenfood', override: { nombreVisual: 'rebanadas de pan de salvado', presentacion: 'fondo_blanco' } },
  { nombre: 'Pera, pulpa, fresca, cruda', fuente: 'argenfood', override: { nombreVisual: 'una pera fresca entera', presentacion: 'fondo_blanco' } },
  { nombre: 'Huevo de gallina, entero, crudo', fuente: 'argenfood', override: { nombreVisual: 'un huevo de gallina entero', presentacion: 'fondo_blanco' } },
  { nombre: 'Leche de vaca parcialm. descremada, adic. con vit A y D', fuente: 'argenfood', override: { nombreVisual: 'un vaso de leche', presentacion: 'vaso' } },
  { nombre: 'Queso crema, entero, untable', fuente: 'argenfood', override: { nombreVisual: 'queso crema untable', presentacion: 'cuenco_blanco_chico' } },
  { nombre: 'Cebolla blanca, bulbo, cruda', fuente: 'argenfood', override: { nombreVisual: 'una cebolla blanca entera', presentacion: 'fondo_blanco' } },
  { nombre: 'Tomate, fresco, crudo', fuente: 'argenfood', override: { nombreVisual: 'un tomate rojo fresco entero', presentacion: 'fondo_blanco' } },
  { nombre: 'Zanahoria, raiz, pelada, fresca', fuente: 'argenfood', override: { nombreVisual: 'una zanahoria fresca pelada', presentacion: 'fondo_blanco' } },
  { nombre: 'queso untable clásico — ilolay', fuente: 'off', override: { nombreVisual: 'queso crema untable, sin marca', presentacion: 'cuenco_blanco_chico' } },
  { nombre: 'Pan Lactal Cero — Bimbo', fuente: 'off', override: { nombreVisual: 'rebanadas de pan lactal', presentacion: 'fondo_blanco' } },
  { nombre: 'Pan Integral 100% Grano Entero — Bimbo', fuente: 'off', override: { nombreVisual: 'rebanadas de pan integral', presentacion: 'fondo_blanco' } },
  { nombre: 'Yogur griego — Kay', fuente: 'off', override: { nombreVisual: 'yogur griego, sin envase ni marca', presentacion: 'cuenco_blanco_chico' } },
  { nombre: 'Arvejas — Ciudad Del Lago', fuente: 'off', override: { nombreVisual: 'un puñado de arvejas verdes', presentacion: 'fondo_blanco' } },
  { nombre: 'Atun', fuente: 'off', override: { nombreVisual: 'atún en conserva, sin lata ni marca', presentacion: 'cuenco_blanco_chico' } },
  { nombre: 'fideos  secos', fuente: 'off', override: { nombreVisual: 'fideos secos crudos', presentacion: 'fondo_blanco' } },
  { nombre: 'Medallones de carne vacuna 356', fuente: 'off', override: { nombreVisual: 'medallones de carne vacuna cocidos', presentacion: 'plato_blanco' } },
  { nombre: 'Morrones', fuente: 'off', override: { nombreVisual: 'un morrón rojo entero', presentacion: 'fondo_blanco' } },
]

const MODEL = 'gemini-nano-banana-2.1'
const OUT_DIR = path.join(import.meta.dirname, '_data')
const OUT_PATH = path.join(OUT_DIR, 'batch-1-requests.jsonl')

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno. Abortando.')
    process.exit(1)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY en el entorno. Abortando.')
    process.exit(1)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const lineas: string[] = []
  const noEncontrados: string[] = []
  const yaGenerados: string[] = []

  for (const item of BATCH_1) {
    const { data, error } = await db
      .from('vademecum_alimentos')
      .select('id, nombre, fuente, image_url')
      .eq('nombre', item.nombre)
      .eq('fuente', item.fuente)
      .maybeSingle()

    if (error) {
      console.error(`Error consultando "${item.nombre}" (${item.fuente}):`, error.message)
      continue
    }
    if (!data) {
      noEncontrados.push(`${item.nombre} (${item.fuente})`)
      continue
    }
    if (data.image_url) {
      yaGenerados.push(data.nombre)
      continue
    }

    const prompt = construirPromptAlimento(data.nombre, data.fuente, item.override)
    lineas.push(JSON.stringify({
      key: data.id,
      request: {
        contents: [{ parts: [{ text: prompt }] }],
        generation_config: { response_modalities: ['TEXT', 'IMAGE'] },
      },
    }))
  }

  if (noEncontrados.length > 0) {
    console.warn('No se encontraron en vademecum_alimentos (revisar nombre/fuente exactos):')
    noEncontrados.forEach((n) => console.warn(`  - ${n}`))
  }
  if (yaGenerados.length > 0) {
    console.log(`Saltados (ya tienen imagen): ${yaGenerados.join(', ')}`)
  }

  if (lineas.length === 0) {
    console.log('Nada para generar — todos ya tienen imagen o no se encontraron.')
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_PATH, lineas.join('\n') + '\n', 'utf-8')
  console.log(`JSONL escrito en ${OUT_PATH} (${lineas.length} alimentos).`)

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  console.log('Subiendo el archivo...')
  const archivo = await ai.files.upload({ file: OUT_PATH, config: { mimeType: 'jsonl' } })
  console.log('Archivo subido:', archivo.name)

  console.log('Creando el batch job...')
  const job = await ai.batches.create({
    model: MODEL,
    src: archivo.name!,
  })

  console.log('Batch job creado. Guardá este ID para scripts/batch-foods-collect.ts:')
  console.log(job.name)
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
