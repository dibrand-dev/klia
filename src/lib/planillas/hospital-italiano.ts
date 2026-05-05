import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib'

export interface SesionPlanilla {
  dia: string        // "01"
  mes: string        // "12"
  horaInicio: string // "19:00"
  horaFin: string    // "19:45"
  firmaProfesionalUrl?: string
  firmaPacienteUrl?: string
}

export interface DatosPlanilla {
  anio: string
  prestador: string
  domicilio: string
  afiliado: string
  numeroSocio: string
  tratamiento: string
  mes: string          // "DICIEMBRE"
  numeroAutorizacion: string
  sesiones: SesionPlanilla[]
  logoUrl?: string
}

// ── Page constants ───────────────────────────────────────────────────────────
const PAGE_H = 841.89
const PAGE_W = 595.28
const L = 40
const W = PAGE_W - 2 * L

// Table columns
const COL_X = [40, 120, 210, 310, 430]
const COL_W = [80,  90, 100, 120, 125]
const COL_HDR = [
  'DIA / MES',
  'HORA DE INICIO',
  'HORA DE\nFINALIZACION',
  'FIRMA Y SELLO\nDEL PROFESIONAL',
  'FIRMA Y ACLARACION\nDEL BENEF/PADRE/TUTOR',
]
const ROW_H = 65
const HDR_H = 28

// Colors
const C_BLACK  = rgb(0,     0,     0)
const C_DARK   = rgb(0.133, 0.133, 0.133)
const C_GRAY33 = rgb(0.2,   0.2,   0.2)
const C_MUTED  = rgb(0.6,   0.6,   0.6)
const C_LIGHT  = rgb(0.8,   0.8,   0.8)
const C_GREEN  = rgb(0x2d / 255, 0x6a / 255, 0x4f / 255)

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert pdfkit top-left Y to pdf-lib bottom-left baseline Y */
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
    // Try JPEG as fallback for unknown formats
    return await doc.embedJpg(buf)
  } catch {
    try { return await doc.embedPng(buf) } catch { return null }
  }
}

interface Fonts { reg: PDFFont; bold: PDFFont; obl: PDFFont }

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawLabeledLine(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  kitY: number,
  width: number,
  label: string,
  value: string,
  leftAlign = false,
) {
  const FS = 9
  const baseY = yb(kitY, FS)

  page.drawText(label, { x, y: baseY, font: fonts.reg, size: FS, color: C_DARK })
  const labelW = fonts.reg.widthOfTextAtSize(label, FS)

  const valW = fonts.bold.widthOfTextAtSize(value, FS)

  if (leftAlign) {
    // Value placed immediately after label with one space gap
    const spaceW = fonts.reg.widthOfTextAtSize(' ', FS)
    const valX = x + labelW + spaceW
    page.drawText(value, { x: valX, y: baseY, font: fonts.bold, size: FS, color: C_BLACK })
    const dotX1 = valX + valW + 4
    const dotX2 = x + width
    if (dotX2 > dotX1 + 4) {
      page.drawLine({
        start: { x: dotX1, y: baseY + 1 },
        end:   { x: dotX2, y: baseY + 1 },
        thickness: 0.4, color: C_MUTED,
        dashArray: [1, 2.5], dashPhase: 0,
      })
    }
  } else {
    page.drawText(value, { x: x + width - valW, y: baseY, font: fonts.bold, size: FS, color: C_BLACK })
    const dotX1 = x + labelW + 4
    const dotX2 = x + width - valW - 4
    if (dotX2 > dotX1 + 4) {
      page.drawLine({
        start: { x: dotX1, y: baseY + 1 },
        end:   { x: dotX2, y: baseY + 1 },
        thickness: 0.4, color: C_MUTED,
        dashArray: [1, 2.5], dashPhase: 0,
      })
    }
  }
}

function drawTableHeader(page: PDFPage, fonts: Fonts, kitY: number) {
  const FS = 8
  for (let i = 0; i < 5; i++) {
    page.drawRectangle({
      x: COL_X[i], y: yb(kitY, HDR_H),
      width: COL_W[i], height: HDR_H,
      borderColor: C_BLACK, borderWidth: 0.5,
    })
    const lines = COL_HDR[i].split('\n')
    const lineH = FS + 3
    const totalH = lines.length * lineH
    const startKitY = kitY + (HDR_H - totalH) / 2
    for (let li = 0; li < lines.length; li++) {
      const lw = fonts.bold.widthOfTextAtSize(lines[li], FS)
      page.drawText(lines[li], {
        x: COL_X[i] + (COL_W[i] - lw) / 2,
        y: yb(startKitY + li * lineH, FS),
        font: fonts.bold, size: FS, color: C_BLACK,
      })
    }
  }
}

function drawRow(
  page: PDFPage,
  fonts: Fonts,
  kitY: number,
  sesion: SesionPlanilla | null,
  imgCache: Record<string, PDFImage | null>,
) {
  for (let i = 0; i < 5; i++) {
    page.drawRectangle({
      x: COL_X[i], y: yb(kitY, ROW_H),
      width: COL_W[i], height: ROW_H,
      borderColor: C_BLACK, borderWidth: 0.5,
    })
  }

  if (!sesion) {
    const midY = kitY + ROW_H / 2
    page.drawLine({
      start: { x: COL_X[0] + 6, y: yb(midY) },
      end:   { x: COL_X[0] + COL_W[0] - 6, y: yb(midY) },
      thickness: 0.4, color: C_LIGHT,
      dashArray: [1, 2.5], dashPhase: 0,
    })
    return
  }

  const FS = 10
  const textKitY = kitY + ROW_H / 2 - FS / 2

  const drawCentered = (text: string, colIdx: number) => {
    const tw = fonts.reg.widthOfTextAtSize(text, FS)
    page.drawText(text, {
      x: COL_X[colIdx] + (COL_W[colIdx] - tw) / 2,
      y: yb(textKitY, FS),
      font: fonts.reg, size: FS, color: C_BLACK,
    })
  }

  drawCentered(`${sesion.dia}/${sesion.mes}`, 0)
  drawCentered(sesion.horaInicio, 1)
  drawCentered(sesion.horaFin, 2)

  const drawSig = (url: string | undefined, colIdx: number) => {
    if (!url || !imgCache[url]) return
    const img = imgCache[url]!
    const sigMaxW = COL_W[colIdx] - 2
    const sigMaxH = 63
    const dims = imgScale(img, sigMaxW, sigMaxH)
    const xCentered = COL_X[colIdx] + (COL_W[colIdx] - dims.width) / 2
    const yOffset = (ROW_H - dims.height) / 2
    page.drawImage(img, {
      x: xCentered,
      y: yb(kitY + yOffset, dims.height),
      width: dims.width, height: dims.height,
    })
  }

  drawSig(sesion.firmaProfesionalUrl, 3)
  drawSig(sesion.firmaPacienteUrl, 4)
}

// ── Page renderers ───────────────────────────────────────────────────────────

function renderFirstPage(
  page: PDFPage,
  fonts: Fonts,
  datos: DatosPlanilla,
  imgCache: Record<string, PDFImage | null>,
) {
  // Logo
  const logoImg = datos.logoUrl ? imgCache[datos.logoUrl] : null
  if (logoImg) {
    const dims = imgScale(logoImg, 120, 50)
    page.drawImage(logoImg, { x: L, y: yb(36, dims.height), width: dims.width, height: dims.height })
  } else {
    page.drawText('HOSPITAL ITALIANO', { x: L, y: yb(40, 9), font: fonts.bold, size: 9, color: C_GREEN })
    page.drawText('de Buenos Aires',   { x: L, y: yb(52, 7), font: fonts.reg,  size: 7, color: C_GREEN })
    page.drawText('PLAN DE SALUD',     { x: L, y: yb(62, 7), font: fonts.reg,  size: 7, color: C_GREEN })
  }

  // Title
  const titleText = 'PLANILLA DE ASISTENCIA A TRATAMIENTOS  AÑO ' + datos.anio
  const titleFS = 12
  const titleW = fonts.bold.widthOfTextAtSize(titleText, titleFS)
  const titleX = L + (W - titleW) / 2
  const titleKitY = 82
  page.drawText(titleText, { x: titleX, y: yb(titleKitY, titleFS), font: fonts.bold, size: titleFS, color: C_BLACK })
  page.drawLine({
    start: { x: titleX, y: yb(titleKitY, titleFS) - 2 },
    end:   { x: titleX + titleW, y: yb(titleKitY, titleFS) - 2 },
    thickness: 0.5, color: C_BLACK,
  })

  // Subtitle
  const subText = 'Adjuntar esta documentacion en "original" junto a la factura o recibo que emita.'
  const subFS = 9
  const subW = fonts.obl.widthOfTextAtSize(subText, subFS)
  page.drawText(subText, { x: L + (W - subW) / 2, y: yb(100, subFS), font: fonts.obl, size: subFS, color: C_GRAY33 })

  // Fields
  const FY = 122
  const FH = 18
  const FS = 9

  drawLabeledLine(page, fonts, L, FY,      W, 'Nombre y apellido del prestador/Razon Social:', datos.prestador, true)
  drawLabeledLine(page, fonts, L, FY + FH, W, 'Domicilio donde realiza la Prestacion:', datos.domicilio)

  // Field 3: afiliado + n° socio (inline segments)
  const y3 = FY + FH * 2
  const yT3 = yb(y3, FS)
  let cx3 = L
  const seg3 = [
    { text: 'Dejo constancia que el afiliado', font: fonts.reg, color: C_DARK },
    { text: '  ' + datos.afiliado,             font: fonts.bold, color: C_BLACK },
    { text: '  n° socio',                       font: fonts.reg, color: C_DARK },
    { text: '  ' + datos.numeroSocio,           font: fonts.bold, color: C_BLACK },
  ]
  for (const s of seg3) {
    page.drawText(s.text, { x: cx3, y: yT3, font: s.font, size: FS, color: s.color })
    cx3 += s.font.widthOfTextAtSize(s.text, FS)
  }

  // Field 4: tratamiento + mes
  const y4 = FY + FH * 3
  const yT4 = yb(y4, FS)
  let cx4 = L
  const seg4 = [
    { text: 'Ha concurrido a tratamiento de',      font: fonts.reg, color: C_DARK },
    { text: '  ' + datos.tratamiento,              font: fonts.bold, color: C_BLACK },
    { text: '  durante el mes de',                 font: fonts.reg, color: C_DARK },
    { text: '  ' + datos.mes + '  ' + datos.anio, font: fonts.bold, color: C_BLACK },
  ]
  for (const s of seg4) {
    page.drawText(s.text, { x: cx4, y: yT4, font: s.font, size: FS, color: s.color })
    cx4 += s.font.widthOfTextAtSize(s.text, FS)
  }

  drawLabeledLine(page, fonts, L, FY + FH * 4, W, 'N° de autorizacion:', datos.numeroAutorizacion, true)

  // Table — with ROW_H=65, max 9 rows fit on first page (593pt available after header)
  const ROWS_P1 = 9
  const tableY = FY + FH * 5 + 8
  drawTableHeader(page, fonts, tableY)
  let rowY = tableY + HDR_H
  for (let i = 0; i < ROWS_P1; i++) {
    drawRow(page, fonts, rowY, datos.sesiones[i] ?? null, imgCache)
    rowY += ROW_H
  }
}

function renderContinuationPage(
  page: PDFPage,
  fonts: Fonts,
  sesiones: SesionPlanilla[],
  imgCache: Record<string, PDFImage | null>,
) {
  // With ROW_H=65, max 11 rows fit on continuation pages (773pt available after header)
  const ROWS_CONT = 11
  drawTableHeader(page, fonts, 40)
  let rowY = 40 + HDR_H
  for (let i = 0; i < ROWS_CONT; i++) {
    drawRow(page, fonts, rowY, sesiones[i] ?? null, imgCache)
    rowY += ROW_H
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function generarPlanillaHospitalItaliano(datos: DatosPlanilla): Promise<Buffer> {
  console.log(`[planilla] sesiones: ${datos.sesiones.length}`)

  // Collect image URLs
  const allUrls: string[] = []
  if (datos.logoUrl) allUrls.push(datos.logoUrl)
  for (const s of datos.sesiones) {
    if (s.firmaProfesionalUrl && !allUrls.includes(s.firmaProfesionalUrl)) allUrls.push(s.firmaProfesionalUrl)
    if (s.firmaPacienteUrl    && !allUrls.includes(s.firmaPacienteUrl))    allUrls.push(s.firmaPacienteUrl)
  }

  // Pre-fetch raw image buffers
  const rawCache: Record<string, Buffer | null> = {}
  await Promise.all(allUrls.map(async (url) => { rawCache[url] = await fetchImg(url) }))

  // Create PDF and embed fonts
  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    reg:  await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    obl:  await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  }

  // Embed images
  const imgCache: Record<string, PDFImage | null> = {}
  await Promise.all(
    allUrls.map(async (url) => {
      imgCache[url] = rawCache[url] ? await embedImg(pdfDoc, rawCache[url]!) : null
    })
  )

  // Page 1
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H])
  renderFirstPage(page1, fonts, datos, imgCache)

  // Continuation page if more than 9 sessions (first page capacity with ROW_H=65)
  if (datos.sesiones.length > 9) {
    const page2 = pdfDoc.addPage([PAGE_W, PAGE_H])
    renderContinuationPage(page2, fonts, datos.sesiones.slice(9), imgCache)
  }

  return Buffer.from(await pdfDoc.save())
}
