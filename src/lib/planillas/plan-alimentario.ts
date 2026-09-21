import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage, LineCapStyle } from 'pdf-lib'

// ── Datos de entrada ─────────────────────────────────────────────────────────

export interface ItemComida {
  tipo: string // 'alimento' | 'texto_libre'
  nombre: string // ya resuelto: contenido_texto, o nombre del alimento del Vademécum
  cantidadGramos: number | null
}

export interface ComidaPlan {
  diaSemana: string // 'lunes'..'domingo'
  tipoComida: string // 'Desayuno' | 'Colación' | 'Almuerzo' | 'Merienda' | 'Cena' | otro
  hora: string | null // 'HH:MM'
  nota: string | null
  items: ItemComida[]
}

export interface ProximoTurnoPlan {
  fechaHora: string // ISO
  modalidad: 'presencial' | 'videollamada' | 'telefonica'
  direccionSede: string | null
}

export interface DatosPlanAlimentario {
  // Paciente
  pacienteNombreCompleto: string
  // Profesional
  profesionalNombreCorto: string // "Lic. Valeria Ocampo"
  especialidad: string
  matricula: string // ya formateada: "MN 4821" / "MP 4821 (CABA)" / crudo
  telefono: string | null
  email: string | null
  firmaSelloUrl: string | null
  avatarUrl: string | null
  // Plan
  objetivoTitulo: string | null
  objetivoNota: string | null
  kcalObjetivo: number | null
  porcentajeCarbohidratos: number
  porcentajeProteinas: number
  porcentajeGrasas: number
  indicaciones: string[] // una línea = un bullet
  fechaPreparacion: string // ISO (created_at del plan)
  fechaFin: string | null // ISO (date)
  proximoTurno: ProximoTurnoPlan | null
  // Comidas — kcal reales por día vienen ya calculadas (del endpoint de macros)
  comidas: ComidaPlan[]
  kcalPorDia: Record<string, number> // diaSemana -> kcal reales
}

// ── Constantes de página ─────────────────────────────────────────────────────

const PAGE_W = 595.28 // A4
const PAGE_H = 841.89
const MARGIN = 50.4 // 0.7in
const L = MARGIN
const R = PAGE_W - MARGIN
const W = R - L

const HEADER_H = 44
const FOOTER_H = 30
const CONTENT_TOP = MARGIN + HEADER_H + 14 // debajo del header corrido
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H - 10 // arriba del footer corrido

// ── Colores (tomados 1:1 de los tokens del diseño) ───────────────────────────

function hex(h: string) {
  const n = parseInt(h.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const C_PRO = hex('#3F519E')
const C_PRO_SOFT = hex('#F4F6FC')
const C_PRO_LINE = hex('#D5DCF0')
const C_INK = hex('#0E1430')
const C_INK2 = hex('#2A2F4A')
const C_SLATE = hex('#5A607A')
const C_SLATE2 = hex('#8990AA')
const C_LINE = hex('#E5E7EF')
const C_LINE2 = hex('#EFF1F7')
const C_WARM = hex('#FBFAF7')
const C_WHITE = rgb(1, 1, 1)
const C_GOAL_NOTE = hex('#3A4577')

const DAY_THEMES = [
  { border: C_PRO_LINE, left: C_PRO, bg: C_PRO_SOFT, kc: C_GOAL_NOTE },
  { border: hex('#DDD9EC'), left: hex('#6E5FB0'), bg: hex('#F4F2FB'), kc: hex('#4E4383') },
  { border: hex('#D6E0EC'), left: hex('#41608A'), bg: hex('#EEF3F8'), kc: hex('#3B5474') },
]

const MACRO_COLORS = { carbohidratos: hex('#3F519E'), proteinas: hex('#7D8AC4'), grasas: hex('#C6CCE5') }

// ── Íconos por tipo de comida (paths SVG del diseño, viewBox 0 0 24 24) ──────

const ICON_PATHS: Record<string, { circle?: { cx: number; cy: number; r: number }; path: string }> = {
  Desayuno: {
    circle: { cx: 12, cy: 12, r: 4 },
    path: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  'Colación': {
    path: 'M12 20a7 7 0 0 0 7-7c0-4-3-6-3-9-2 1.5-3 3.5-3 5.5 0 1.5-1 2.5-2 2.5s-1.5-1-1.5-2C7 12 5 14 5 16.5A5.5 5.5 0 0 0 12 20z',
  },
  Almuerzo: {
    path: 'M5 3v7a2.5 2.5 0 0 0 5 0V3M7.5 12.5V21M19 3c-1.7 1.2-2.5 3-2.5 5.5S17.3 12 19 13v8',
  },
  Merienda: {
    path: 'M4 9h13a3 3 0 0 1 0 6H4zM4 9v6M17 12h3M6 19h11',
  },
  Cena: {
    path: 'M18.5 12.5A6.5 6.5 0 1 1 11 5.05a5 5 0 0 0 7.5 7.45z',
  },
}
// Ícono genérico (punto) para un tipo_comida que no matchea ninguno conocido.
const ICON_GENERICO = { circle: { cx: 12, cy: 12, r: 5 }, path: '' }

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}
const ORDEN_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// ── Helpers ──────────────────────────────────────────────────────────────────

function yb(kitY: number, fontSize = 0): number {
  return PAGE_H - kitY - fontSize
}

function imgScale(img: PDFImage, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height, 1)
  return { width: img.width * s, height: img.height * s }
}

async function fetchImg(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function embedImg(doc: PDFDocument, buf: Buffer): Promise<PDFImage | null> {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return await doc.embedPng(buf)
    if (buf[0] === 0xFF && buf[1] === 0xD8) return await doc.embedJpg(buf)
    return await doc.embedJpg(buf)
  } catch {
    try { return await doc.embedPng(buf) } catch { return null }
  }
}

interface Fonts { reg: PDFFont; bold: PDFFont; obl: PDFFont }

/** Envuelve texto a un ancho máximo, devolviendo un array de líneas. */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

interface RunDeTexto { text: string; font: PDFFont; color: ReturnType<typeof rgb> }
interface PalabraWrap { text: string; font: PDFFont; color: ReturnType<typeof rgb> }

/**
 * Wrap a nivel de palabra sobre varios "runs" con fuente/color propios (ej.
 * nombre en bold + sufijo en regular) — a diferencia de wrapText, cada línea
 * devuelta conserva qué palabras van en qué fuente, así una línea puede
 * arrancar en bold y terminar en regular sin cortar texto a la mitad.
 */
function wrapRuns(runs: RunDeTexto[], size: number, maxWidth: number): PalabraWrap[][] {
  const palabras: PalabraWrap[] = []
  for (const run of runs) {
    for (const w of run.text.split(/\s+/).filter(Boolean)) {
      palabras.push({ text: w, font: run.font, color: run.color })
    }
  }
  if (palabras.length === 0) return [[]]

  const lineas: PalabraWrap[][] = []
  let actual: PalabraWrap[] = []
  let anchoActual = 0
  for (const palabra of palabras) {
    const anchoEspacio = actual.length > 0 ? palabra.font.widthOfTextAtSize(' ', size) : 0
    const anchoPalabra = palabra.font.widthOfTextAtSize(palabra.text, size)
    if (actual.length > 0 && anchoActual + anchoEspacio + anchoPalabra > maxWidth) {
      lineas.push(actual)
      actual = [palabra]
      anchoActual = anchoPalabra
    } else {
      actual.push(palabra)
      anchoActual += anchoEspacio + anchoPalabra
    }
  }
  if (actual.length > 0) lineas.push(actual)
  return lineas
}

/** Dibuja las líneas devueltas por wrapRuns, palabra por palabra con su propia fuente. */
function drawWrappedRuns(page: PDFPage, lineas: PalabraWrap[][], x: number, kitYPrimeraLinea: number, size: number, lineHeight: number) {
  lineas.forEach((linea, li) => {
    let cx = x
    const kitY = kitYPrimeraLinea + li * lineHeight
    linea.forEach((palabra, wi) => {
      if (wi > 0) cx += palabra.font.widthOfTextAtSize(' ', size)
      page.drawText(palabra.text, { x: cx, y: yb(kitY, size), font: palabra.font, size, color: palabra.color })
      cx += palabra.font.widthOfTextAtSize(palabra.text, size)
    })
  })
}

function drawIcon(
  page: PDFPage,
  tipoComida: string,
  kitX: number,
  kitY: number, // top del ícono
  size: number,
  color = C_PRO,
) {
  const def = ICON_PATHS[tipoComida] ?? ICON_GENERICO
  const scale = size / 24
  const originY = yb(kitY) // pdf-lib y del origen SVG (0,0) del ícono

  if (def.circle) {
    const { cx, cy, r } = def.circle
    page.drawEllipse({
      x: kitX + cx * scale,
      y: originY - cy * scale,
      xScale: r * scale,
      yScale: r * scale,
      borderColor: color,
      borderWidth: 1.6 * scale,
    })
  }
  if (def.path) {
    page.drawSvgPath(def.path, {
      x: kitX,
      y: originY,
      scale,
      borderColor: color,
      borderWidth: 1.6,
      borderLineCap: LineCapStyle.Round,
    })
  }
}

function formatFechaLarga(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

function formatFechaHoraTurno(iso: string): string {
  const d = new Date(iso)
  const diaLabel = DIAS_SEMANA_LARGO[d.getUTCDay()]
  const diaLabelCap = diaLabel.charAt(0).toUpperCase() + diaLabel.slice(1)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${diaLabelCap} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}, ${hh}:${mm} h`
}

// ── Header / footer corridos ──────────────────────────────────────────────────

interface RunningCtx {
  fonts: Fonts
  profesionalNombreCorto: string
  especialidad: string
  matricula: string
  fechaEmision: string
  avatarImg: PDFImage | null
}

function drawRunningHeader(page: PDFPage, ctx: RunningCtx) {
  const kitY = MARGIN
  const lineY = yb(kitY + HEADER_H)
  page.drawLine({ start: { x: L, y: lineY }, end: { x: R, y: lineY }, thickness: 0.75, color: C_PRO_LINE })

  const circleR = 17
  const circleCx = L + circleR
  const circleCy = yb(kitY + circleR)
  page.drawEllipse({ x: circleCx, y: circleCy, xScale: circleR, yScale: circleR, color: C_PRO_SOFT, borderColor: C_PRO_LINE, borderWidth: 1 })
  if (ctx.avatarImg) {
    // Recorte circular exacto no está disponible en la API de alto nivel de
    // pdf-lib para drawImage — se aproxima llenando el círculo con la foto
    // recortada a cuadrado (mismo criterio ya usado para logos/firmas en el
    // resto de los generadores de planillas, que tampoco hacen clip real).
    const side = circleR * 2 - 2
    page.drawImage(ctx.avatarImg, { x: circleCx - side / 2, y: circleCy - side / 2, width: side, height: side })
  } else {
    const iniciales = ctx.profesionalNombreCorto.replace(/^Lic\.|^Dr\.|^Dra\.|^Mg\./i, '').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
    const inicialesW = ctx.fonts.bold.widthOfTextAtSize(iniciales, 11)
    page.drawText(iniciales, { x: circleCx - inicialesW / 2, y: circleCy - 4, font: ctx.fonts.bold, size: 11, color: C_PRO })
  }

  const textX = L + circleR * 2 + 9
  page.drawText(ctx.profesionalNombreCorto, { x: textX, y: yb(kitY + 16, 12.5), font: ctx.fonts.bold, size: 12.5, color: C_INK })
  page.drawText(`${ctx.especialidad} · ${ctx.matricula}`, { x: textX, y: yb(kitY + 30, 9.5), font: ctx.fonts.reg, size: 9.5, color: C_SLATE })

  const rightText = `Emitido ${ctx.fechaEmision}`
  const rightW = ctx.fonts.reg.widthOfTextAtSize(rightText, 9.5)
  page.drawText(rightText, { x: R - rightW, y: yb(kitY + 30, 9.5), font: ctx.fonts.reg, size: 9.5, color: C_SLATE })
}

function drawRunningFooter(page: PDFPage, ctx: RunningCtx, pageNum: number) {
  const kitY = PAGE_H - MARGIN - FOOTER_H
  const lineY = yb(kitY)
  page.drawLine({ start: { x: L, y: lineY }, end: { x: R, y: lineY }, thickness: 0.75, color: C_LINE })

  const left = 'Plan alimentario · Documento de uso personal'
  page.drawText(left, { x: L, y: yb(kitY + 15, 8.5), font: ctx.fonts.reg, size: 8.5, color: C_SLATE2 })

  const right = `${ctx.profesionalNombreCorto} · ${ctx.matricula} · Página ${pageNum}`
  const rightW = ctx.fonts.reg.widthOfTextAtSize(right, 8.5)
  page.drawText(right, { x: R - rightW, y: yb(kitY + 15, 8.5), font: ctx.fonts.reg, size: 8.5, color: C_SLATE2 })
}

// ── Generador principal ───────────────────────────────────────────────────────

export async function generarPdfPlanAlimentario(datos: DatosPlanAlimentario): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    reg: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    obl: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  }

  const [firmaBuf, avatarBuf] = await Promise.all([
    datos.firmaSelloUrl ? fetchImg(datos.firmaSelloUrl) : Promise.resolve(null),
    datos.avatarUrl ? fetchImg(datos.avatarUrl) : Promise.resolve(null),
  ])
  const firmaImg = firmaBuf ? await embedImg(pdfDoc, firmaBuf) : null
  const avatarImg = avatarBuf ? await embedImg(pdfDoc, avatarBuf) : null

  const runningCtx: RunningCtx = {
    fonts,
    profesionalNombreCorto: datos.profesionalNombreCorto,
    especialidad: datos.especialidad,
    matricula: datos.matricula,
    fechaEmision: formatFechaCorta(new Date().toISOString()),
    avatarImg,
  }

  let page!: PDFPage
  let pageNum = 0
  let cy = CONTENT_TOP // cursor vertical (kitY, top-down)

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    pageNum++
    drawRunningHeader(page, runningCtx)
    cy = CONTENT_TOP
  }

  function finishPage() {
    drawRunningFooter(page, runningCtx, pageNum)
  }

  /** Asegura que quede espacio suficiente en la página actual; si no, pagina. */
  function ensureSpace(height: number, onNewPage?: () => void) {
    if (cy + height > CONTENT_BOTTOM) {
      finishPage()
      newPage()
      onNewPage?.()
    }
  }

  // ── Portada ────────────────────────────────────────────────────────────────
  newPage()

  // Eyebrow
  page!.drawEllipse({ x: L + 2.5, y: yb(cy, -3), xScale: 2.5, yScale: 2.5, color: C_PRO })
  page!.drawText('PLAN ALIMENTARIO PERSONALIZADO', { x: L + 12, y: yb(cy, 9.5), font: fonts.bold, size: 9.5, color: C_PRO })
  cy += 22

  // H1
  const h1Size = 26
  page!.drawText(datos.pacienteNombreCompleto, { x: L, y: yb(cy, h1Size), font: fonts.bold, size: h1Size, color: C_INK })
  cy += h1Size + 6
  page!.drawText('tu plan de la semana', { x: L, y: yb(cy, 18), font: fonts.obl, size: 18, color: C_PRO })
  cy += 26

  const vigenciaTxt = datos.fechaFin
    ? `Preparado el ${formatFechaLarga(datos.fechaPreparacion)} · Vigente hasta el ${formatFechaCorta(datos.fechaFin)}`
    : `Preparado el ${formatFechaLarga(datos.fechaPreparacion)}`
  page!.drawText(vigenciaTxt, { x: L, y: yb(cy, 10.5), font: fonts.reg, size: 10.5, color: C_SLATE })
  cy += 28

  // Hero: Objetivo + Valor calórico (lado a lado) — alto calculado del
  // contenido real de cada card (no un valor fijo: una nota de 1 línea y una
  // de 4 necesitan cajas de alto distinto), tomando el máximo de las dos.
  const goalW = W * 0.57
  const vctW = W - goalW - 18
  const objetivoTitulo = datos.objetivoTitulo ?? 'Sin definir'
  const tituloStartKitY = 38
  const tituloLineH = fonts.bold.heightAtSize(15, { descender: true })
  const tituloLineStep = tituloLineH + 2
  const tituloLines = wrapText(fonts.bold, objetivoTitulo, 15, goalW - 32)
  const tituloBottomKitY = tituloStartKitY + (tituloLines.length - 1) * tituloLineStep + tituloLineH

  const notaLines = datos.objetivoNota ? wrapText(fonts.reg, datos.objetivoNota, 9.5, goalW - 32) : []
  const notaStartKitY = tituloBottomKitY + 12 // aire real entre la última línea del título y la nota
  const notaLineStep = 13
  const goalContentBottomKitY = notaLines.length > 0
    ? notaStartKitY + (notaLines.length - 1) * notaLineStep + fonts.reg.heightAtSize(9.5, { descender: true })
    : tituloBottomKitY
  const goalCardH = goalContentBottomKitY + 18 // padding inferior

  const kcalNumKitY = 52
  const kcalNumH = fonts.bold.heightAtSize(30, { descender: true })
  const kcalUnitKitY = kcalNumKitY + kcalNumH + 6 // 6pt de aire real entre el número y la unidad
  const kcalUnitH = fonts.reg.heightAtSize(8.5, { descender: true })
  const vctCardH = kcalUnitKitY + kcalUnitH + 16 // padding inferior

  const heroH = Math.max(goalCardH, vctCardH, 92) // 92 = piso visual del diseño original

  page!.drawRectangle({ x: L, y: yb(cy, heroH), width: goalW, height: heroH, color: C_PRO_SOFT, borderColor: C_PRO_LINE, borderWidth: 1 })
  page!.drawText('OBJETIVO DEL PLAN', { x: L + 16, y: yb(cy + 20, 8), font: fonts.bold, size: 8, color: C_PRO })
  tituloLines.forEach((line, i) => {
    page!.drawText(line, { x: L + 16, y: yb(cy + tituloStartKitY + i * tituloLineStep, 15), font: fonts.bold, size: 15, color: C_INK })
  })
  notaLines.forEach((line, i) => {
    page!.drawText(line, { x: L + 16, y: yb(cy + notaStartKitY + i * notaLineStep, 9.5), font: fonts.reg, size: 9.5, color: C_GOAL_NOTE })
  })

  const vctX = L + goalW + 18
  page!.drawRectangle({ x: vctX, y: yb(cy, heroH), width: vctW, height: heroH, color: C_WHITE, borderColor: C_LINE, borderWidth: 1 })
  const vctLbl = 'VALOR CALÓRICO TOTAL DIARIO'
  const vctLblW = fonts.bold.widthOfTextAtSize(vctLbl, 7.5)
  page!.drawText(vctLbl, { x: vctX + (vctW - vctLblW) / 2, y: yb(cy + 18, 7.5), font: fonts.bold, size: 7.5, color: C_PRO })
  const kcalTxt = datos.kcalObjetivo != null ? Math.round(datos.kcalObjetivo).toLocaleString('es-AR') : '—'
  const kcalW = fonts.bold.widthOfTextAtSize(kcalTxt, 30)
  page!.drawText(kcalTxt, { x: vctX + (vctW - kcalW) / 2, y: yb(cy + kcalNumKitY, 30), font: fonts.bold, size: 30, color: C_PRO })
  const kcalUnit = 'KCAL / DÍA'
  const kcalUnitW = fonts.reg.widthOfTextAtSize(kcalUnit, 8.5)
  page!.drawText(kcalUnit, { x: vctX + (vctW - kcalUnitW) / 2, y: yb(cy + kcalUnitKitY, 8.5), font: fonts.reg, size: 8.5, color: C_SLATE })

  cy += heroH + 22

  // Barra apilada de macros + lista
  const macroDefs: { key: 'carbohidratos' | 'proteinas' | 'grasas'; label: string; sub: string; pct: number }[] = [
    { key: 'carbohidratos', label: 'Carbohidratos', sub: 'Cereales integrales, frutas, legumbres', pct: datos.porcentajeCarbohidratos },
    { key: 'proteinas', label: 'Proteínas', sub: 'Carnes magras, huevo, lácteos, legumbres', pct: datos.porcentajeProteinas },
    { key: 'grasas', label: 'Grasas', sub: 'Palta, frutos secos, aceite de oliva', pct: datos.porcentajeGrasas },
  ]
  const macrosBoxH = 34 + 18 + macroDefs.length * 34 + 20
  page!.drawRectangle({ x: L, y: yb(cy, macrosBoxH), width: W, height: macrosBoxH, borderColor: C_LINE, borderWidth: 1 })
  let barX = L + 20
  const barY = cy + 20
  const barW = W - 40
  const barH = 26
  for (const m of macroDefs) {
    const segW = (m.pct / 100) * barW
    const textColor = m.key === 'grasas' ? C_INK : C_WHITE
    page!.drawRectangle({ x: barX, y: yb(barY, barH), width: segW, height: barH, color: MACRO_COLORS[m.key] })
    const pctTxt = `${Math.round(m.pct)} %`
    const pctW = fonts.bold.widthOfTextAtSize(pctTxt, 9.5)
    if (segW > pctW + 8) {
      page!.drawText(pctTxt, { x: barX + segW / 2 - pctW / 2, y: yb(barY + barH / 2 + 4, 9.5), font: fonts.bold, size: 9.5, color: textColor })
    }
    barX += segW
  }

  let mY = barY + barH + 18
  for (const m of macroDefs) {
    page!.drawRectangle({ x: L + 20, y: yb(mY, 12), width: 12, height: 12, color: MACRO_COLORS[m.key], borderColor: C_INK, borderWidth: 0.5 })
    page!.drawText(m.label, { x: L + 42, y: yb(mY + 2, 11), font: fonts.bold, size: 11, color: C_INK })
    page!.drawText(m.sub, { x: L + 42, y: yb(mY + 16, 8.5), font: fonts.reg, size: 8.5, color: C_SLATE })
    const pctTxt = `${Math.round(m.pct)} %`
    const pctW = fonts.bold.widthOfTextAtSize(pctTxt, 11)
    page!.drawText(pctTxt, { x: R - 20 - 60 - pctW, y: yb(mY + 8, 11), font: fonts.bold, size: 11, color: C_INK })
    const gramos = datos.kcalObjetivo != null ? Math.round((datos.kcalObjetivo * (m.pct / 100)) / (m.key === 'grasas' ? 9 : 4)) : null
    const gramosTxt = gramos != null ? `${gramos} g` : '—'
    const gramosW = fonts.reg.widthOfTextAtSize(gramosTxt, 9.5)
    page!.drawText(gramosTxt, { x: R - 20 - gramosW, y: yb(mY + 8, 9.5), font: fonts.reg, size: 9.5, color: C_SLATE })
    mY += 34
  }
  cy += macrosBoxH + 18

  // Panel "Indicaciones para arrancar"
  if (datos.indicaciones.length > 0) {
    const indLineH = 12.5
    const indBullets = datos.indicaciones.map((txt) => wrapText(fonts.reg, txt, 9.7, W - 66))
    const indH = 40 + indBullets.reduce((acc, lines) => acc + lines.length * indLineH + 5, 0)
    page!.drawRectangle({ x: L, y: yb(cy, indH), width: W, height: indH, color: C_WARM, borderColor: C_LINE, borderWidth: 1 })
    page!.drawText('Indicaciones para arrancar', { x: L + 18, y: yb(cy + 24, 10.5), font: fonts.bold, size: 10.5, color: C_INK })
    let iY = cy + 42
    for (const lines of indBullets) {
      page!.drawEllipse({ x: L + 22, y: yb(iY + 5, -2), xScale: 2, yScale: 2, color: C_PRO })
      lines.forEach((line, li) => {
        page!.drawText(line, { x: L + 34, y: yb(iY + li * indLineH, 9.7), font: fonts.reg, size: 9.7, color: C_INK2 })
      })
      iY += lines.length * indLineH + 5
    }
    cy += indH + 16
  }

  // Bloque de vigencia
  const vigH = 46
  page!.drawRectangle({ x: L, y: yb(cy, vigH), width: W, height: vigH, color: C_WHITE, borderColor: C_PRO_LINE, borderWidth: 1 })
  const vigItems: { label: string; value: string }[] = []
  vigItems.push({
    label: 'VIGENCIA DEL PLAN',
    value: datos.fechaFin
      ? `${formatFechaCorta(datos.fechaPreparacion)} — ${formatFechaCorta(datos.fechaFin)}`
      : `Desde ${formatFechaCorta(datos.fechaPreparacion)}`,
  })
  if (datos.proximoTurno) {
    vigItems.push({ label: 'PRÓXIMO CONTROL', value: formatFechaHoraTurno(datos.proximoTurno.fechaHora) })
    vigItems.push({
      label: 'MODALIDAD',
      value: datos.proximoTurno.modalidad === 'presencial' ? 'Presencial' : datos.proximoTurno.modalidad === 'videollamada' ? 'Videollamada' : 'Telefónica',
    })
    if (datos.proximoTurno.direccionSede) {
      vigItems.push({ label: 'CONSULTORIO', value: datos.proximoTurno.direccionSede })
    }
  } else {
    vigItems.push({ label: 'PRÓXIMO CONTROL', value: 'Sin turno agendado' })
  }
  const vigColW = W / vigItems.length
  vigItems.forEach((it, i) => {
    const x = L + i * vigColW + 16
    page!.drawText(it.label, { x, y: yb(cy + 18, 7.5), font: fonts.bold, size: 7.5, color: C_PRO })
    const valueLines = wrapText(fonts.bold, it.value, 10, vigColW - 28).slice(0, 2)
    valueLines.forEach((line, li) => {
      page!.drawText(line, { x, y: yb(cy + 32 + li * 12, 10), font: fonts.bold, size: 10, color: C_INK })
    })
    if (i > 0) {
      page!.drawLine({ start: { x: L + i * vigColW, y: yb(cy + 8) }, end: { x: L + i * vigColW, y: yb(cy + vigH - 8) }, thickness: 0.5, color: C_LINE })
    }
  })
  cy += vigH + 10

  if (datos.proximoTurno) {
    page!.drawText('La modalidad y la dirección corresponden a la sede del próximo turno agendado.', {
      x: L, y: yb(cy, 8), font: fonts.obl, size: 8, color: C_SLATE2,
    })
  }

  finishPage()

  // ── Páginas por día ───────────────────────────────────────────────────────
  const diasConComidas = ORDEN_DIAS.filter((dia) => datos.comidas.some((c) => c.diaSemana === dia))

  diasConComidas.forEach((dia, diaIdx) => {
    const tema = DAY_THEMES[diaIdx % 3]
    const comidasDelDia = datos.comidas
      .filter((c) => c.diaSemana === dia)
      .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))

    newPage()

    function drawDayHeader() {
      const hdH = 40
      page!.drawRectangle({ x: L, y: yb(cy, hdH), width: W, height: hdH, color: tema.bg, borderColor: tema.border, borderWidth: 1 })
      page!.drawRectangle({ x: L, y: yb(cy, hdH), width: 4, height: hdH, color: tema.left })
      page!.drawText(DIA_LABEL[dia] ?? dia, { x: L + 18, y: yb(cy + 26, 15), font: fonts.bold, size: 15, color: C_INK })
      const kcalDia = datos.kcalPorDia[dia]
      const kcalTxtDia = kcalDia != null && kcalDia > 0
        ? `~ ${Math.round(kcalDia).toLocaleString('es-AR')} Kcal · ${comidasDelDia.length} comida${comidasDelDia.length === 1 ? '' : 's'}`
        : `${comidasDelDia.length} comida${comidasDelDia.length === 1 ? '' : 's'}`
      const kcalTxtW = fonts.reg.widthOfTextAtSize(kcalTxtDia, 9)
      page!.drawText(kcalTxtDia, { x: R - 18 - kcalTxtW, y: yb(cy + 24, 9), font: fonts.reg, size: 9, color: tema.kc })
      cy += hdH + 16
    }

    drawDayHeader()

    const itemsX = L + 152
    const itemsMaxWidth = W - 152 - 21

    for (const comida of comidasDelDia) {
      // Pre-cálculo real (no estimado) de las líneas de cada ítem, con wrap
      // mixto bold(nombre)/regular(sufijo) por palabra — mismo mecanismo que
      // se usa al dibujar, para que la altura reservada coincida con lo real.
      const itemsWrapped = comida.items.map((it) => {
        const runs: RunDeTexto[] = it.tipo === 'alimento' && it.cantidadGramos != null
          ? [
              { text: it.nombre, font: fonts.bold, color: C_INK },
              { text: `— ${it.cantidadGramos} g`, font: fonts.reg, color: C_INK2 },
            ]
          : [{ text: it.nombre, font: fonts.reg, color: C_INK2 }]
        return wrapRuns(runs, 10.5, itemsMaxWidth)
      })
      const notaLines = comida.nota ? wrapText(fonts.reg, comida.nota, 9, itemsMaxWidth - 1) : []

      // Chequeo blando: evita arrancar el título de la comida pegado al pie
      // de página, aunque después la lista de ítems sí puede paginar sola.
      const alturaMinima = 34 + (itemsWrapped[0]?.length ?? 1) * 13
      ensureSpace(alturaMinima, drawDayHeader)

      const mealTop = cy
      drawIcon(page!, comida.tipoComida, L, mealTop, 15, C_PRO)
      page!.drawText(comida.tipoComida, { x: L + 22, y: yb(mealTop + 2, 11), font: fonts.bold, size: 11, color: C_INK })
      if (comida.hora) {
        page!.drawText(comida.hora, { x: L + 22, y: yb(mealTop + 17, 8.5), font: fonts.reg, size: 8.5, color: C_SLATE2 })
      }

      let itemY = mealTop
      comida.items.forEach((it, i) => {
        const lineas = itemsWrapped[i]
        const itemH = lineas.length * 13 + 3

        // Paginación real ítem por ítem: si el ítem no entra en lo que queda
        // de página, se corta acá (no a la mitad del ítem) y se retoma con un
        // header de comida compacto "(continuación)" en la página siguiente.
        if (itemY + itemH > CONTENT_BOTTOM) {
          finishPage()
          newPage()
          drawDayHeader()
          const contTop = cy
          drawIcon(page!, comida.tipoComida, L, contTop, 15, C_PRO)
          page!.drawText(`${comida.tipoComida} (continuación)`, { x: L + 22, y: yb(contTop + 2, 11), font: fonts.bold, size: 11, color: C_INK })
          itemY = contTop + 22
        }

        page!.drawEllipse({ x: itemsX + 2.5, y: yb(itemY + 7, -2), xScale: 2, yScale: 2, color: C_PRO_LINE })
        drawWrappedRuns(page!, lineas, itemsX + 12, itemY, 10.5, 13)
        itemY += itemH
      })

      if (notaLines.length > 0) {
        const notaH = notaLines.length * 11 + 7
        if (itemY + notaH > CONTENT_BOTTOM) {
          finishPage()
          newPage()
          drawDayHeader()
          itemY = cy
        }
        itemY += 7
        page!.drawEllipse({ x: itemsX + 6, y: yb(itemY + 6, -2), xScale: 5.5, yScale: 5.5, borderColor: C_SLATE2, borderWidth: 1 })
        notaLines.forEach((line, li) => {
          page!.drawText(line, { x: itemsX + 18, y: yb(itemY + li * 11, 9), font: fonts.obl, size: 9, color: C_SLATE })
        })
        itemY += notaLines.length * 11
      }

      cy = itemY + 20
      ensureSpace(1, drawDayHeader) // si la línea separadora cae justo en el borde, pagina antes de dibujarla
      page!.drawLine({ start: { x: L, y: yb(cy - 8) }, end: { x: R, y: yb(cy - 8) }, thickness: 0.5, color: C_LINE2 })
    }

    finishPage()
  })

  // ── Página de cierre ──────────────────────────────────────────────────────
  newPage()

  page!.drawEllipse({ x: L + 2.5, y: yb(cy, -3), xScale: 2.5, yScale: 2.5, color: C_PRO })
  page!.drawText('CIERRE Y CONTACTO', { x: L + 12, y: yb(cy, 9.5), font: fonts.bold, size: 9.5, color: C_PRO })
  cy += 26
  page!.drawText('Contacto', { x: L, y: yb(cy, 22), font: fonts.obl, size: 22, color: C_PRO })
  cy += 40

  const contactH = 96
  page!.drawRectangle({ x: L, y: yb(cy, contactH), width: W, height: contactH, color: C_WHITE, borderColor: C_PRO_LINE, borderWidth: 1 })
  const colW = W / 2
  const contactLeft: [string, string][] = [
    ['PROFESIONAL', datos.profesionalNombreCorto],
    ['ESPECIALIDAD', datos.especialidad],
    ['MATRÍCULA', datos.matricula],
  ]
  const contactRight: [string, string][] = [
    ['TELÉFONO / WHATSAPP', datos.telefono ?? '—'],
    ['EMAIL', datos.email ?? '—'],
  ]
  function drawContactCol(items: [string, string][], x: number) {
    let y = cy + 22
    for (const [label, value] of items) {
      page!.drawText(label, { x: x + 20, y: yb(y, 7.5), font: fonts.bold, size: 7.5, color: C_SLATE2 })
      page!.drawText(value, { x: x + 20, y: yb(y + 15, 10.5), font: fonts.reg, size: 10.5, color: C_INK })
      y += 30
    }
  }
  drawContactCol(contactLeft, L)
  drawContactCol(contactRight, L + colW)
  cy += contactH + 18

  // Confidencialidad
  const confTxt = 'Confidencialidad. Este documento es de uso personal del paciente arriba mencionado. Contiene datos de salud protegidos por la Ley 25.326 de Protección de Datos Personales. No constituye una indicación válida para terceros.'
  const confLines = wrapText(fonts.reg, confTxt, 9, W - 45)
  const confH = confLines.length * 12 + 20
  page!.drawRectangle({ x: L, y: yb(cy, confH), width: W, height: confH, color: hex('#F7F8FB'), borderColor: C_LINE, borderWidth: 1 })
  page!.drawRectangle({ x: L, y: yb(cy, confH), width: 2.5, height: confH, color: C_SLATE2 })
  confLines.forEach((line, i) => {
    const isFirst = i === 0
    page!.drawText(
      isFirst ? line.replace('Confidencialidad. ', '') : line,
      { x: L + 15, y: yb(cy + 14 + i * 12, 9), font: isFirst ? fonts.bold : fonts.reg, size: 9, color: C_SLATE },
    )
  })
  cy += confH + 24

  // Firma
  page!.drawLine({ start: { x: L, y: yb(cy) }, end: { x: R, y: yb(cy) }, thickness: 0.75, color: C_PRO_LINE })
  cy += 20
  page!.drawText(datos.profesionalNombreCorto, { x: L, y: yb(cy, 13), font: fonts.bold, size: 13, color: C_INK })
  page!.drawText(`${datos.especialidad} · ${datos.matricula}`, { x: L, y: yb(cy + 16, 8.5), font: fonts.reg, size: 8.5, color: C_SLATE })

  const sigBoxW = 190
  const sigBoxX = R - sigBoxW
  if (firmaImg) {
    const dims = imgScale(firmaImg, sigBoxW - 10, 40)
    page!.drawImage(firmaImg, { x: sigBoxX + (sigBoxW - dims.width) / 2, y: yb(cy + 30, dims.height), width: dims.width, height: dims.height })
  }
  page!.drawLine({ start: { x: sigBoxX, y: yb(cy + 34) }, end: { x: R, y: yb(cy + 34) }, thickness: 0.75, color: C_LINE })
  page!.drawText('Firma del profesional', { x: sigBoxX, y: yb(cy + 46, 8), font: fonts.obl, size: 8, color: C_SLATE2 })

  finishPage()

  return Buffer.from(await pdfDoc.save())
}
