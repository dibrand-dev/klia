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

// 'fondo_blanco': crudo con forma propia, sin plato. 'plato_blanco' /
// 'cuenco_blanco_chico': cocido o sin forma definida. 'vaso': líquidos.
export type Presentacion = 'fondo_blanco' | 'plato_blanco' | 'cuenco_blanco_chico' | 'vaso'

const PRESENTACION_TEXTO: Record<Presentacion, string> = {
  fondo_blanco: 'Presentación: directo sobre fondo blanco liso, sin plato ni recipiente.',
  plato_blanco: 'Presentación: servido en un plato blanco liso y chico, sin bordes decorados.',
  cuenco_blanco_chico: 'Presentación: servido en un cuenco blanco liso y chico, sin bordes decorados.',
  vaso: 'Presentación: servido en un vaso simple y transparente.',
}

export interface OverridesPrompt {
  // Nombre genérico ya resuelto a mano (ej. por el batch de los 21) — si se
  // pasa, reemplaza por completo al nombre del vademécum en el prompt.
  nombreVisual?: string
  // Presentación fija, también resuelta a mano. Sin esto, se delega la
  // elección a Gemini según el tipo de alimento (regla genérica abajo).
  presentacion?: Presentacion
  // Contexto extra para el caso genérico (sin nombreVisual/presentacion):
  // "nombre + grupo" en vez de nombre solo.
  grupo?: string
}

export function construirPromptAlimento(nombre: string, fuente: string, overrides: OverridesPrompt = {}): string {
  const esMarca = fuente === 'off'
  const base = overrides.nombreVisual ?? (esMarca ? nombreSinMarca(nombre) : nombre)
  const contexto = !overrides.nombreVisual && overrides.grupo ? ` (grupo: ${overrides.grupo})` : ''
  const reglasMarca = esMarca && !overrides.nombreVisual
    ? ' Es un producto de marca: usá el nombre genérico del ingrediente, nunca la marca — sin envase, sin logos ni packaging. Si el nombre incluye variantes comerciales o términos de marketing ("Cero", "Light", nombres de línea, etc.), generalizalo al ingrediente base que representa.'
    : ''
  const presentacionTexto = overrides.presentacion
    ? PRESENTACION_TEXTO[overrides.presentacion]
    : 'Presentación según el tipo de alimento: si es un ingrediente crudo con forma propia (fruta, verdura, corte de carne entero, etc.), directo sobre fondo blanco liso, sin plato. Si está cocido o no tiene una forma definida propia, servido en un plato o cuenco blanco liso y chico, sin bordes decorados. Si es líquido, servido en un vaso simple.'

  return (
    `Fotografía gastronómica minimalista de "${base}"${contexto} como ingrediente individual. ` +
    'Vista cenital o ligeramente angulada, luz natural suave, fondo blanco o neutro limpio, enfoque nítido, relación de aspecto 1:1. ' +
    `${presentacionTexto} ` +
    'El alimento ocupa aprox. el 70% del cuadro, centrado, con margen alrededor, composición simple de un solo elemento, sin detalles finos. ' +
    'Mostrá únicamente el alimento pedido: sin envases, sin marcas, sin logos, sin texto, sin marcas de agua ni cubiertos.' +
    reglasMarca
  )
}

export class GeneracionImagenError extends Error {}

// Siempre pasa por sharp antes de subir — nunca se sube el Base64 original
// de Gemini (tamaño/formato no controlados, puede no ser siquiera webp).
export async function generarImagenAlimento(alimento: { id: string; nombre: string; fuente: string }, overrides: OverridesPrompt = {}): Promise<string> {
  const ai = clienteGemini()
  const prompt = construirPromptAlimento(alimento.nombre, alimento.fuente, overrides)

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

  // Re-reclamable si quedó colgado en 'generating' por más de 10 minutos
  // (proceso caído a mitad de camino, nunca llegó a 'ready' ni a 'failed').
  const haceDiezMinutos = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: reclamado, error: errorReclamo } = await db
    .from('vademecum_alimentos')
    .update({ image_status: 'generating', image_updated_at: new Date().toISOString() })
    .eq('id', alimentoId)
    .is('image_url', null)
    .or(`image_status.eq.pending,and(image_status.eq.generating,image_updated_at.lt.${haceDiezMinutos})`)
    .select('id, nombre, fuente, grupo')
    .maybeSingle()

  if (errorReclamo) {
    console.error('[food-images] Error en el reclamo atómico:', errorReclamo)
    return
  }
  if (!reclamado) return // ya tiene imagen, ya está generándose, o ya falló antes

  try {
    const url = await generarImagenAlimento({ id: reclamado.id, nombre: reclamado.nombre, fuente: reclamado.fuente }, { grupo: reclamado.grupo })
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
