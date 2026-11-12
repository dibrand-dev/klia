// Prueba de UN alimento (PASO 5) — genera la imagen con Gemini, la sube a
// Vercel Blob, guarda la URL en vademecum_alimentos y la imprime.
// Uso: npx tsx scripts/test-food-image.ts
//
// Necesita en el entorno (no en .env.local del repo — nunca secretos ahí):
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
// BLOB_READ_WRITE_TOKEN (la inyecta Vercel solo si el Blob store está
// conectado al proyecto — en local hay que exportarla a mano).
import { createClient } from '@supabase/supabase-js'
import { generarImagenAlimento } from '../src/lib/food-images'

const NOMBRE = 'Tomate, fresco, crudo'
const FUENTE = 'argenfood'

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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Falta BLOB_READ_WRITE_TOKEN en el entorno. Abortando.')
    process.exit(1)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: alimento, error } = await db
    .from('vademecum_alimentos')
    .select('id, nombre, fuente, image_url, image_status')
    .eq('nombre', NOMBRE)
    .eq('fuente', FUENTE)
    .maybeSingle()

  if (error) {
    console.error('Error consultando vademecum_alimentos:', error.message)
    process.exit(1)
  }
  if (!alimento) {
    console.error(`No se encontró "${NOMBRE}" (fuente ${FUENTE}) en vademecum_alimentos.`)
    process.exit(1)
  }

  console.log(`Alimento encontrado: ${alimento.id} — ${alimento.nombre} (image_status actual: ${alimento.image_status})`)
  console.log('Generando imagen con Gemini...')

  const url = await generarImagenAlimento({ id: alimento.id, nombre: alimento.nombre, fuente: alimento.fuente })

  const { error: errorUpdate } = await db
    .from('vademecum_alimentos')
    .update({ image_url: url, image_status: 'ready', image_updated_at: new Date().toISOString() })
    .eq('id', alimento.id)

  if (errorUpdate) {
    console.error('Imagen generada pero no se pudo guardar en Supabase:', errorUpdate.message)
    console.log('URL generada (no persistida):', url)
    process.exit(1)
  }

  console.log('OK — URL guardada en vademecum_alimentos.image_url:')
  console.log(url)
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
