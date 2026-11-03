// Detección del tipo real de un archivo de imagen por sus primeros bytes —
// nunca confiar en el nombre/extensión ni en el Content-Type que manda el
// cliente. Solo WebP y JPEG: son los dos únicos formatos que puede producir
// src/lib/portal/imagen.ts (WebP, o JPEG como fallback de navegadores que no
// codifican WebP, como Safari).
export function tipoImagenReal(buffer: Buffer): 'webp' | 'jpeg' | null {
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // "RIFF"
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // "WEBP"
  ) {
    return 'webp'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }
  return null
}
