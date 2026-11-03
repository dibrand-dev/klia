// Compresión 100% en el navegador para el registro de comidas del portal —
// nunca se sube la foto original. Re-codificar siempre (nunca copiar bytes
// tal cual) también elimina el EXIF/GPS de paso.
//
// Safari de iOS (confirmado en iPhone X / iOS 16) puede rechazar
// createImageBitmap(file, {imageOrientation:'from-image'}) para una foto de
// 12 MP recién sacada de cámara — por soporte parcial de la opción, por
// presión de memoria decodificando el bitmap a resolución completa, o
// ambas. Por eso hay una cadena de fallbacks completa antes de rendirse:
// createImageBitmap con opciones → sin opciones → <img>+decode() (Safari
// aplica la orientación EXIF al renderizar un <img> por defecto, así que
// este camino no pierde la rotación) — y, dentro de cada fuente, una
// escalera de tamaños de canvas más chicos si falla dibujar/codificar.
export class ImagenError extends Error {
  constructor(
    public codigo: 'tamano' | 'decode',
    message: string,
    public ancho?: number,
    public alto?: number,
  ) {
    super(message)
  }
}

const MAX_ENTRADA_BYTES = 15 * 1024 * 1024
const LADOS_FOTO = [1280, 1024, 800]
const LADOS_THUMB = [320, 256, 200]
// Calidad inicial (0.78/0.72) elegida para rondar los objetivos de diseño
// (~400 KB foto, ~40 KB miniatura) en el caso típico; estos son los topes
// duros que fuerzan a bajar más la calidad si no alcanza.
const MAX_FOTO_BYTES = 1024 * 1024
const MAX_THUMB_BYTES = 100 * 1024

export interface FotoProcesada {
  foto: Blob
  miniatura: Blob
  ext: 'webp' | 'jpeg'
}

type Canvas = OffscreenCanvas | HTMLCanvasElement
type Fuente = ImageBitmap | HTMLImageElement

function anchoAlto(fuente: Fuente): { w: number; h: number } {
  return fuente instanceof HTMLImageElement
    ? { w: fuente.naturalWidth, h: fuente.naturalHeight }
    : { w: fuente.width, h: fuente.height }
}

function cerrarFuente(fuente: Fuente) {
  if (fuente instanceof HTMLImageElement) URL.revokeObjectURL(fuente.src)
  else fuente.close()
}

async function decodificarConImg(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
    return img
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

async function decodificar(file: File): Promise<Fuente> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch { /* probamos el siguiente camino */ }
  try {
    return await createImageBitmap(file)
  } catch { /* probamos el siguiente camino */ }
  try {
    return await decodificarConImg(file)
  } catch {
    throw new ImagenError('decode', 'No pudimos leer esta foto.')
  }
}

function nuevoCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function dimensionesEscaladas(w: number, h: number, ladoLargo: number): { w: number; h: number } {
  const max = Math.max(w, h)
  if (max <= ladoLargo) return { w, h }
  const factor = ladoLargo / max
  return { w: Math.max(1, Math.round(w * factor)), h: Math.max(1, Math.round(h * factor)) }
}

function dibujar(fuente: Fuente, w: number, h: number): Canvas {
  const canvas = nuevoCanvas(w, h)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas')
  ctx.drawImage(fuente, 0, 0, w, h)
  return canvas
}

function aBlob(canvas: Canvas, type: string, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), type, quality)
  })
}

// WebP con fallback a JPEG para navegadores que no lo codifican (Safari
// devuelve un PNG si se le pide 'image/webp' en toBlob, en vez de fallar).
async function codificar(canvas: Canvas, quality: number): Promise<{ blob: Blob; ext: 'webp' | 'jpeg' }> {
  const webp = await aBlob(canvas, 'image/webp', quality)
  if (webp.type === 'image/webp') return { blob: webp, ext: 'webp' }
  const jpeg = await aBlob(canvas, 'image/jpeg', quality)
  return { blob: jpeg, ext: 'jpeg' }
}

async function codificarConLimite(
  canvas: Canvas,
  calidadInicial: number,
  maxBytes: number,
): Promise<{ blob: Blob; ext: 'webp' | 'jpeg' }> {
  let quality = calidadInicial
  let resultado = await codificar(canvas, quality)
  let intentos = 0
  while (resultado.blob.size > maxBytes && intentos < 6 && quality > 0.35) {
    quality = Math.max(0.35, quality - 0.12)
    resultado = await codificar(canvas, quality)
    intentos++
  }
  return resultado
}

// Dibujar y codificar a un lado largo puntual puede fallar por presión de
// memoria del canvas (sobre todo en iOS con fotos de 12+ MP) — se prueba
// con lados cada vez más chicos antes de rendirse.
async function procesarConEscalera(
  fuente: Fuente, lados: number[], calidad: number, maxBytes: number,
): Promise<{ blob: Blob; ext: 'webp' | 'jpeg' }> {
  const { w: ow, h: oh } = anchoAlto(fuente)
  let ultimoError: unknown = null
  for (const ladoLargo of lados) {
    try {
      const { w, h } = dimensionesEscaladas(ow, oh, ladoLargo)
      const canvas = dibujar(fuente, w, h)
      return await codificarConLimite(canvas, calidad, maxBytes)
    } catch (e) {
      ultimoError = e
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error('No se pudo procesar la foto')
}

// onProgress: 0-35, pensado para mapearse a la primera parte de la barra de
// "Optimizando foto..." del sheet de confirmación (el resto, 35-100, es la
// subida real por XHR, con progreso real de red).
export async function procesarFoto(file: File, onProgress?: (pct: number) => void): Promise<FotoProcesada> {
  if (file.size > MAX_ENTRADA_BYTES) {
    throw new ImagenError('tamano', 'La foto es demasiado grande.')
  }

  const fuente = await decodificar(file)
  onProgress?.(10)

  const { w: anchoOriginal, h: altoOriginal } = anchoAlto(fuente)

  try {
    let resultadoFoto
    try {
      resultadoFoto = await procesarConEscalera(fuente, LADOS_FOTO, 0.78, MAX_FOTO_BYTES)
    } catch {
      throw new ImagenError('decode', 'No pudimos leer esta foto.', anchoOriginal, altoOriginal)
    }
    onProgress?.(28)

    let resultadoThumb
    try {
      resultadoThumb = await procesarConEscalera(fuente, LADOS_THUMB, 0.72, MAX_THUMB_BYTES)
    } catch {
      throw new ImagenError('decode', 'No pudimos leer esta foto.', anchoOriginal, altoOriginal)
    }
    onProgress?.(35)

    return { foto: resultadoFoto.blob, miniatura: resultadoThumb.blob, ext: resultadoFoto.ext }
  } finally {
    cerrarFuente(fuente)
  }
}
