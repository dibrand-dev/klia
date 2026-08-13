import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib'

export interface SesionPami {
  dia: string        // "01"
  mes: string         // "12"
  firmaProfesionalUrl?: string
  firmaFamiliarUrl?: string
}

export interface DatosPami {
  afiliadoNombre: string
  numeroBeneficio: string
  afiliadoDni: string
  familiarNombre?: string
  profesionalNombre: string
  matricula: string
  nombrePrestador: string
  sesiones: SesionPami[]
  logoUrl?: string
}

// ── Page constants ───────────────────────────────────────────────────────────
const PAGE_H = 841.89
const PAGE_W = 595.28
const L = 40
const W = PAGE_W - 2 * L

// Table columns — Fecha | Firma Profesional | Firma Afiliado/Familiar/Responsable
const COL_X = [L, L + 90, L + 90 + 205]
const COL_W = [90, 205, W - 90 - 205]
const COL_HDR = [
  'Fecha',
  'Firma y Aclaración Profesional',
  'Firma y Aclaración\nAfiliado/Familiar/Responsable',
]
const ROW_H = 65
const HDR_H = 28
const ROWS_P1 = 8
const ROWS_CONT = 11

// Colors
const C_BLACK    = rgb(0, 0, 0)
const C_DARK     = rgb(0.133, 0.133, 0.133)
const C_MUTED    = rgb(0.6, 0.6, 0.6)
const C_LIGHT    = rgb(0.8, 0.8, 0.8)
const C_PAMI     = rgb(0x29 / 255, 0xAB / 255, 0xE2 / 255)
const C_PAMI_GRAY = rgb(0.55, 0.58, 0.62)
const C_LABEL_BG = rgb(0.92, 0.92, 0.92)
const C_TABLE_HDR_BG = rgb(0.80, 0.90, 0.97)

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

interface Fonts { reg: PDFFont; bold: PDFFont }

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawSectionTitle(page: PDFPage, fonts: Fonts, kitY: number, text: string) {
  const FS = 12
  page.drawText(text, { x: L, y: yb(kitY, FS), font: fonts.bold, size: FS, color: C_PAMI })
  const w = fonts.bold.widthOfTextAtSize(text, FS)
  page.drawLine({
    start: { x: L, y: yb(kitY, FS) - 3 },
    end: { x: L + Math.max(w, W * 0.55), y: yb(kitY, FS) - 3 },
    thickness: 1, color: C_PAMI,
  })
}

function drawField(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  kitY: number,
  labelW: number,
  valueW: number,
  rowH: number,
  label: string,
  value: string,
) {
  const FS = 8.5

  // Label cell
  page.drawRectangle({
    x, y: yb(kitY, rowH), width: labelW, height: rowH,
    color: C_LABEL_BG, borderColor: C_BLACK, borderWidth: 0.5,
  })
  page.drawText(label, {
    x: x + 5, y: yb(kitY + rowH / 2 - FS / 2, FS),
    font: fonts.reg, size: FS, color: C_DARK,
  })

  // Value cell
  page.drawRectangle({
    x: x + labelW, y: yb(kitY, rowH), width: valueW, height: rowH,
    borderColor: C_BLACK, borderWidth: 0.5,
  })
  if (value) {
    page.drawText(value, {
      x: x + labelW + 5, y: yb(kitY + rowH / 2 - FS / 2, FS),
      font: fonts.bold, size: FS, color: C_BLACK,
    })
  }
}

function drawFieldRow(
  page: PDFPage,
  fonts: Fonts,
  kitY: number,
  rowH: number,
  fields: { label: string; value: string; labelW: number; valueW: number }[],
) {
  let x = L
  for (const f of fields) {
    drawField(page, fonts, x, kitY, f.labelW, f.valueW, rowH, f.label, f.value)
    x += f.labelW + f.valueW
  }
}

function drawTableHeader(page: PDFPage, fonts: Fonts, kitY: number) {
  const FS = 8
  for (let i = 0; i < 3; i++) {
    page.drawRectangle({
      x: COL_X[i], y: yb(kitY, HDR_H),
      width: COL_W[i], height: HDR_H,
      color: C_TABLE_HDR_BG, borderColor: C_BLACK, borderWidth: 0.5,
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
  sesion: SesionPami | null,
  imgCache: Record<string, PDFImage | null>,
) {
  for (let i = 0; i < 3; i++) {
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
      end: { x: COL_X[0] + COL_W[0] - 6, y: yb(midY) },
      thickness: 0.4, color: C_LIGHT,
      dashArray: [1, 2.5], dashPhase: 0,
    })
    return
  }

  const FS = 10
  const textKitY = kitY + ROW_H / 2 - FS / 2
  const fechaTxt = `${sesion.dia}/${sesion.mes}`
  const fw = fonts.reg.widthOfTextAtSize(fechaTxt, FS)
  page.drawText(fechaTxt, {
    x: COL_X[0] + (COL_W[0] - fw) / 2,
    y: yb(textKitY, FS),
    font: fonts.reg, size: FS, color: C_BLACK,
  })

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

  drawSig(sesion.firmaProfesionalUrl, 1)
  drawSig(sesion.firmaFamiliarUrl, 2)
}

// ── Page renderers ───────────────────────────────────────────────────────────

function renderFirstPage(
  page: PDFPage,
  fonts: Fonts,
  datos: DatosPami,
  imgCache: Record<string, PDFImage | null>,
) {
  // Logo
  const logoImg = datos.logoUrl ? imgCache[datos.logoUrl] : null
  if (logoImg) {
    const dims = imgScale(logoImg, 130, 42)
    page.drawImage(logoImg, { x: L, y: yb(24, dims.height), width: dims.width, height: dims.height })
  } else {
    page.drawText('PAMI', { x: L, y: yb(36, 20), font: fonts.bold, size: 20, color: C_PAMI })
    page.drawText('INSSJP', { x: L, y: yb(50, 8), font: fonts.reg, size: 8, color: C_PAMI_GRAY })
  }

  // Title: "CONSTANCIA DE ATENCION DE: <afiliado>"
  const titleKitY = 72
  const titleFS = 13
  const labelText = 'CONSTANCIA DE ATENCION DE: '
  page.drawText(labelText, { x: L, y: yb(titleKitY, titleFS), font: fonts.bold, size: titleFS, color: C_BLACK })
  const labelW = fonts.bold.widthOfTextAtSize(labelText, titleFS)
  page.drawText(datos.afiliadoNombre, {
    x: L + labelW, y: yb(titleKitY, titleFS), font: fonts.bold, size: titleFS, color: C_PAMI,
  })
  const fullW = labelW + fonts.bold.widthOfTextAtSize(datos.afiliadoNombre, titleFS)
  page.drawLine({
    start: { x: L, y: yb(titleKitY, titleFS) - 3 },
    end: { x: L + Math.max(fullW, W * 0.7), y: yb(titleKitY, titleFS) - 3 },
    thickness: 0.6, color: C_PAMI,
  })

  const GRID_ROW_H = 16

  // DATOS DEL AFILIADO
  drawSectionTitle(page, fonts, 94, 'DATOS DEL AFILIADO')
  drawFieldRow(page, fonts, 106, GRID_ROW_H, [
    { label: 'Número de beneficio', value: datos.numeroBeneficio, labelW: 130, valueW: 128 },
    { label: 'Núm. documento', value: datos.afiliadoDni, labelW: 120, valueW: W - 130 - 128 - 120 },
  ])
  drawFieldRow(page, fonts, 106 + GRID_ROW_H, GRID_ROW_H, [
    { label: 'Nombre y apellido', value: datos.afiliadoNombre, labelW: 130, valueW: W - 130 },
  ])

  // DATOS DEL FAMILIAR Y/O RESPONSABLE
  drawSectionTitle(page, fonts, 156, 'DATOS DEL FAMILIAR Y/O RESPONSABLE')
  drawFieldRow(page, fonts, 168, GRID_ROW_H, [
    { label: 'Nombre y apellido', value: datos.familiarNombre ?? '', labelW: 130, valueW: 128 },
    { label: 'Núm. documento', value: '', labelW: 120, valueW: W - 130 - 128 - 120 },
  ])

  // DATOS PROFESIONAL
  drawSectionTitle(page, fonts, 202, 'DATOS PROFESIONAL')
  drawFieldRow(page, fonts, 214, GRID_ROW_H, [
    { label: 'Nombre y Apellido', value: datos.profesionalNombre, labelW: 130, valueW: W - 130 },
  ])
  drawFieldRow(page, fonts, 214 + GRID_ROW_H, GRID_ROW_H, [
    { label: 'Nº de Matricula', value: datos.matricula, labelW: 130, valueW: W - 130 },
  ])
  drawFieldRow(page, fonts, 214 + GRID_ROW_H * 2, GRID_ROW_H, [
    { label: 'Nombre Prestador', value: datos.nombrePrestador, labelW: 130, valueW: W - 130 },
  ])

  // DETALLE DE VISITAS
  const visitasTitleY = 214 + GRID_ROW_H * 3 + 12
  drawSectionTitle(page, fonts, visitasTitleY, 'DETALLE DE VISITAS:')

  const tableY = visitasTitleY + 12
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
  sesiones: SesionPami[],
  imgCache: Record<string, PDFImage | null>,
) {
  drawTableHeader(page, fonts, 40)
  let rowY = 40 + HDR_H
  for (let i = 0; i < ROWS_CONT; i++) {
    drawRow(page, fonts, rowY, sesiones[i] ?? null, imgCache)
    rowY += ROW_H
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function generarPlanillaPami(datos: DatosPami): Promise<Buffer> {
  const allUrls: string[] = []
  if (datos.logoUrl) allUrls.push(datos.logoUrl)
  for (const s of datos.sesiones) {
    if (s.firmaProfesionalUrl && !allUrls.includes(s.firmaProfesionalUrl)) allUrls.push(s.firmaProfesionalUrl)
    if (s.firmaFamiliarUrl && !allUrls.includes(s.firmaFamiliarUrl)) allUrls.push(s.firmaFamiliarUrl)
  }

  const rawCache: Record<string, Buffer | null> = {}
  await Promise.all(allUrls.map(async (url) => { rawCache[url] = await fetchImg(url) }))

  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    reg: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  }

  const imgCache: Record<string, PDFImage | null> = {}
  await Promise.all(
    allUrls.map(async (url) => {
      imgCache[url] = rawCache[url] ? await embedImg(pdfDoc, rawCache[url]!) : null
    })
  )

  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H])
  renderFirstPage(page1, fonts, datos, imgCache)

  if (datos.sesiones.length > ROWS_P1) {
    const restantes = datos.sesiones.slice(ROWS_P1)
    for (let i = 0; i < restantes.length; i += ROWS_CONT) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])
      renderContinuationPage(page, fonts, restantes.slice(i, i + ROWS_CONT), imgCache)
    }
  }

  return Buffer.from(await pdfDoc.save())
}
