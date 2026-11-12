// Generación de imágenes de alimentos del vademécum con Gemini (Interactions
// API — `ai.interactions.create`, no la superficie `generateContent` que
// usan los reportes IA de atenciones/informes, intacta en otro archivo) +
// Vercel Blob para almacenamiento persistente. Supabase guarda solo la URL.
import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import { put } from '@vercel/blob'
import { serviceClient } from '@/lib/supabase/service'

const MODEL = 'gemini-nano-banana-2.1'

function clienteGemini(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
}

// Las fuentes 'off' (Open Food Facts) traen nombre comercial con marca
// separada por un guion largo: "Pan Lactal Cero — Bimbo". Se corta ahí; la
// simplificación fina de términos de marketing ("Cero") queda delegada al
// propio prompt, no a una heurística de texto.
export function nombreSinMarca(nombre: string): string {
  const idx = nombre.indexOf('—')
  return idx === -1 ? nombre.trim() : nombre.slice(0, idx).trim()
}

export function construirPromptAlimento(nombre: string, fuente: string): string {
  const esMarca = fuente === 'off'
  const base = esMarca ? nombreSinMarca(nombre) : nombre
  const reglasMarca = esMarca
    ? ' Es un producto de marca: usá el nombre genérico del ingrediente, nunca la marca — sin envase, sin logos ni packaging. Si el nombre incluye variantes comerciales o términos de marketing ("Cero", "Light", nombres de línea, etc.), generalizalo al ingrediente base que representa.'
    : ''
  return (
    `Fotografía gastronómica minimalista de "${base}" como ingrediente individual. ` +
    'Vista cenital o ligeramente angulada, luz natural suave, fondo blanco o neutro limpio, enfoque nítido, relación de aspecto 1:1. ' +
    'Mostrá únicamente el alimento pedido: sin acompañamientos, sin cubiertos, sin texto ni marcas de agua. ' +
    'Alimento centrado ocupando aprox. el 70% del cuadro, con margen alrededor, composición simple de un solo elemento, sin detalles finos.' +
    reglasMarca
  )
}

export class GeneracionImagenError extends Error {}

// Siempre pasa por sharp antes de subir — nunca se sube el Base64 original
// de Gemini (tamaño/formato no controlados, puede no ser siquiera webp).
export async function generarImagenAlimento(alimento: { id: string; nombre: string; fuente: string }): Promise<string> {
  const ai = clienteGemini()
  const prompt = construirPromptAlimento(alimento.nombre, alimento.fuente)

  const interaction = await ai.interactions.create({
    model: MODEL,
    input: prompt,
    response_format: { type: 'image', aspect_ratio: '1:1' },
  })

  const imagen = interaction.output_image
  if (!imagen?.data) {
    throw new GeneracionImagenError(`Gemini no devolvió imagen para el alimento ${alimento.id} (${alimento.nombre})`)
  }

  const original = Buffer.from(imagen.data, 'base64')
  const webp = await sharp(original)
    .resize(200, 200, { fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer()

  const blob = await put(`vademecum/${alimento.id}.webp`, webp, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'image/webp',
  })

  return blob.url
}

// Reclamo atómico + generación + guardado — el único camino que escribe
// image_status/image_url. Usado tanto por POST /api/foods/[id]/image (bajo
// demanda, usuario autenticado) como por el after() al asignar un alimento
// sin imagen a un plan — mismo código, nunca una llamada HTTP a sí mismo.
export async function intentarGenerarImagen(alimentoId: string): Promise<void> {
  const db = serviceClient()

  const { data: reclamado, error: errorReclamo } = await db
    .from('vademecum_alimentos')
    .update({ image_status: 'generating' })
    .eq('id', alimentoId)
    .is('image_url', null)
    .eq('image_status', 'pending')
    .select('id, nombre, fuente')
    .maybeSingle()

  if (errorReclamo) {
    console.error('[food-images] Error en el reclamo atómico:', errorReclamo)
    return
  }
  if (!reclamado) return // ya tiene imagen, ya está generándose, o ya falló antes

  try {
    const url = await generarImagenAlimento({ id: reclamado.id, nombre: reclamado.nombre, fuente: reclamado.fuente })
    await db
      .from('vademecum_alimentos')
      .update({ image_url: url, image_status: 'ready', image_updated_at: new Date().toISOString() })
      .eq('id', reclamado.id)
  } catch (err) {
    console.error('[food-images] Error generando imagen:', err)
    await db
      .from('vademecum_alimentos')
      .update({ image_status: 'failed', image_updated_at: new Date().toISOString() })
      .eq('id', reclamado.id)
  }
}
