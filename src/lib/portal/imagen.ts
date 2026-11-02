// Compresión 100% en el navegador para el registro de comidas del portal —
// nunca se sube la foto original. Re-codificar siempre (nunca copiar bytes
// tal cual) también elimina el EXIF/GPS de paso.
export class ImagenError extends Error {
  constructor(public codigo: 'tamano' | 'decode', message: string) {
    super(message)
  }
}

const MAX_ENTRADA_BYTES = 15 * 1024 * 1024
const LADO_LARGO_FOTO = 1280
const LADO_LARGO_THUMB = 320
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

function dibujar(bitmap: ImageBitmap, w: number, h: number): Canvas {
  const canvas = nuevoCanvas(w, h)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, w, h)
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

// onProgress: 0-35, pensado para mapearse a la primera parte de la barra de
// "Optimizando foto..." del sheet de confirmación (el resto, 35-100, es la
// subida real por XHR, con progreso real de red).
export async function procesarFoto(file: File, onProgress?: (pct: number) => void): Promise<FotoProcesada> {
  if (file.size > MAX_ENTRADA_BYTES) {
    throw new ImagenError('tamano', 'La foto es demasiado grande.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImagenError('decode', 'No pudimos leer esta foto.')
  }
  onProgress?.(10)

  try {
    const { w, h } = dimensionesEscaladas(bitmap.width, bitmap.height, LADO_LARGO_FOTO)
    const canvasFoto = dibujar(bitmap, w, h)
    onProgress?.(18)

    const { blob: foto, ext } = await codificarConLimite(canvasFoto, 0.78, MAX_FOTO_BYTES)
    onProgress?.(28)

    const { w: tw, h: th } = dimensionesEscaladas(bitmap.width, bitmap.height, LADO_LARGO_THUMB)
    const canvasThumb = dibujar(bitmap, tw, th)
    const { blob: miniatura } = await codificarConLimite(canvasThumb, 0.72, MAX_THUMB_BYTES)
    onProgress?.(35)

    return { foto, miniatura, ext }
  } finally {
    bitmap.close()
  }
}
