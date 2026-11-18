// Somatocarta (SVG) y formatters es-AR. Librería pura: sin dependencias, sin I/O.
// Portado de isak-data.js (diseño), excluyendo clasificadores textuales (fuera de alcance: informes).

const MINUS = '−'

/** Formatea un número en es-AR (coma decimal, menos tipográfico). */
export function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v)) return '—'
  return v.toFixed(d).replace('-', MINUS).replace('.', ',')
}

/** Igual que fmt, pero siempre antepone signo (+/−). Útil para variaciones. */
export function sgn(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v)) return '—'
  const r = Number(v.toFixed(d))
  if (r === 0) return (0).toFixed(d).replace('.', ',')
  return (r > 0 ? '+' : MINUS) + Math.abs(r).toFixed(d).replace('.', ',')
}

/** ISO (YYYY-MM-DD) → DD/MM/YYYY. */
export function fecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export interface PorcionTorta { v: number; c: string }

/** Torta SVG de distribución por tejido (P2 del informe). `v` en cualquier unidad; se normaliza al total. */
export function pie(parts: PorcionTorta[], size = 150): string {
  const r = size / 2, R = r - 1
  let a = -Math.PI / 2
  let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Distribución por tejido">`
  const tot = parts.reduce((t, p) => t + p.v, 0)
  parts.forEach((p) => {
    const da = (p.v / tot) * Math.PI * 2, b = a + da, l = da > Math.PI ? 1 : 0
    s += `<path d="M${r} ${r} L${(r + R * Math.cos(a)).toFixed(2)} ${(r + R * Math.sin(a)).toFixed(2)} A${R} ${R} 0 ${l} 1 ${(r + R * Math.cos(b)).toFixed(2)} ${(r + R * Math.sin(b)).toFixed(2)}Z" fill="${p.c}" stroke="#fff" stroke-width="1.5"/>`
    a = b
  })
  return s + '</svg>'
}

export interface PuntoSomatocarta {
  x: number
  y: number
  kind: 'actual' | 'previo' | 'historico'
  tag?: string
}

export interface EtiquetasSomatocarta { endo?: string; meso?: string; ecto?: string }

export interface OpcionesSomatocarta {
  ink?: string
  muted?: string
  line?: string
  grid?: string
  prev?: string
  old?: string
  font?: string
  w?: number
  /** false oculta las etiquetas; un objeto las reemplaza (ej. "ENDOMORFIA" para el informe del paciente). Default: true, con "ENDOMORFO"/"MESOMORFO"/"ECTOMORFO". */
  labels?: boolean | EtiquetasSomatocarta
}

/**
 * Genera el SVG de la somatocarta (Heath-Carter). X = ecto − endo, Y = 2·meso − (endo + ecto).
 * `pts` puede incluir puntos con x/y null — se filtran antes de dibujar.
 */
export function somatochart(
  pts: (PuntoSomatocarta | null | undefined)[],
  o: OpcionesSomatocarta = {},
): string {
  const c = {
    ink: '#0B1220', muted: '#8A93A1', line: '#E7E9EE', grid: '#F1F3F6',
    prev: '#8A93A1', old: '#AEB5C0', font: 'Inter,sans-serif', w: 300, labels: true,
    ...o,
  }
  const k = c.w / 19, W = c.w, H = Math.round(k * 23), cx = W / 2, cy = k * 14.5
  const P = (x: number, y: number): [number, number] => [
    +(cx + x * k).toFixed(1),
    +(cy - y * k).toFixed(1),
  ]
  const E = P(-6, -6), M = P(0, 12), C = P(6, -6), O = P(0, 0)
  const q = (b: [number, number], ctl: [number, number]) => {
    const p = P(...ctl)
    return `Q${p[0]} ${p[1]} ${b[0]} ${b[1]}`
  }

  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px;margin:0 auto" font-family="${c.font}" role="img" aria-label="Somatocarta">`
  for (let x = -8; x <= 8; x += 2) {
    const a = P(x, -8), b = P(x, 14)
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.grid}" stroke-width="1"/>`
  }
  for (let y = -8; y <= 14; y += 2) {
    const a = P(-9, y), b = P(9, y)
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.grid}" stroke-width="1"/>`
  }
  s += `<path d="M${E[0]} ${E[1]} ${q(M, [-6.6, 4.6])} ${q(C, [6.6, 4.6])} ${q(E, [0, -9.2])}Z" fill="none" stroke="${c.muted}" stroke-width="1.2"/>`
  ;([[E, P(3.3, 3.3)], [M, P(0, -7.6)], [C, P(-3.3, 3.3)]] as [[number, number], [number, number]][]).forEach(
    ([a, b]) => { s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.line}" stroke-width="1" stroke-dasharray="3 3"/>` },
  )
  s += `<circle cx="${O[0]}" cy="${O[1]}" r="1.6" fill="${c.muted}"/>`
  if (c.labels !== false) {
    const etiquetas = typeof c.labels === 'object' ? c.labels : {}
    const txtMeso = etiquetas.meso ?? 'MESOMORFO', txtEndo = etiquetas.endo ?? 'ENDOMORFO', txtEcto = etiquetas.ecto ?? 'ECTOMORFO'
    const fs = Math.max(8, k * 0.62)
    s += `<text x="${M[0]}" y="${M[1] - 8}" text-anchor="middle" font-size="${fs}" font-weight="600" letter-spacing=".06em" fill="${c.muted}">${txtMeso}</text>`
    s += `<text x="${E[0] - 2}" y="${Math.min(H - 3, E[1] + k * 3.6)}" text-anchor="start" font-size="${fs}" font-weight="600" letter-spacing=".06em" fill="${c.muted}">${txtEndo}</text>`
    s += `<text x="${C[0] + 2}" y="${Math.min(H - 3, C[1] + k * 3.6)}" text-anchor="end" font-size="${fs}" font-weight="600" letter-spacing=".06em" fill="${c.muted}">${txtEcto}</text>`
  }
  const v = pts.filter((p): p is PuntoSomatocarta => !!p && p.x != null && p.y != null)
  if (v.length > 1) {
    const d = v.map((p, i) => (i ? 'L' : 'M') + P(p.x, p.y).join(' ')).join(' ')
    s += `<path d="${d}" fill="none" stroke="${c.muted}" stroke-width="1.3" stroke-dasharray="4 3"/>`
  }
  v.forEach((p) => {
    const [x, y] = P(p.x, p.y)
    if (p.kind === 'actual') s += `<circle cx="${x}" cy="${y}" r="5.5" fill="${c.ink}" stroke="#fff" stroke-width="1.5"/>`
    else if (p.kind === 'previo') s += `<rect x="${x - 4.6}" y="${y - 4.6}" width="9.2" height="9.2" transform="rotate(45 ${x} ${y})" fill="${c.prev}" stroke="#fff" stroke-width="1.5"/>`
    else s += `<circle cx="${x}" cy="${y}" r="3.6" fill="#fff" stroke="${c.old}" stroke-width="1.6"/>`
    if (p.tag) s += `<text x="${x + 9}" y="${y + 3.5}" font-size="${Math.max(8, k * 0.58)}" fill="${c.muted}">${p.tag}</text>`
  })
  return s + '</svg>'
}
