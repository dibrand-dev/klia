import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SesionIoma {
  dia: number      // 1-31
  entrada: string  // "HH:MM"
  salida: string   // "HH:MM"
}

export interface DatosIoma {
  paciente: string         // "GARCIA, Juan Carlos"
  nroAfiliado: string
  mes: string              // "JUNIO 2026"
  profesional: string      // "PEREZ, Juan"
  matricula: string
  sesiones: SesionIoma[]   // only days with sessions
  firmaProfesionalUrl?: string
  dni?: string
}

// ── Page constants ───────────────────────────────────────────────────────────

const PAGE_H = 841.89
const PAGE_W = 595.28
const ML = 36
const W  = PAGE_W - 2 * ML  // 523.28

// Column positions and widths (sum = W = 523.28)
const COL_DIA:   [number, number] = [ML,       40]
const COL_ENT:   [number, number] = [ML + 40,  75]
const COL_SAL:   [number, number] = [ML + 115, 75]
const COL_FPROF: [number, number] = [ML + 190, 177]
const COL_FAFIL: [number, number] = [ML + 367, PAGE_W - ML - (ML + 367)]

const TABLE_TOP  = 178   // kitY where table header starts
const HDR_H      = 28
const ROW_H      = 18    // 31 rows × 18 = 558pt → table ends at kitY 764
const ROWS_TOP   = TABLE_TOP + HDR_H  // 206

// Colors
const C_BLACK = rgb(0, 0, 0)
const C_WHITE = rgb(1, 1, 1)
const C_DARK  = rgb(0.13, 0.13, 0.13)
const C_NAVY  = rgb(0.08, 0.14, 0.40)
const C_IOMA  = rgb(0.00, 0.38, 0.70)
const C_MUTED = rgb(0.55, 0.55, 0.55)
const C_LIGHT = rgb(0.80, 0.80, 0.80)

// ── Helpers ──────────────────────────────────────────────────────────────────

function yb(kitY: number, h = 0): number { return PAGE_H - kitY - h }

function imgScale(img: PDFImage, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height, 1)
  return { width: img.width * s, height: img.height * s }
}

async function fetchImg(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
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

// ── Page renderer ────────────────────────────────────────────────────────────

function drawPage(page: PDFPage, fonts: Fonts, datos: DatosIoma, sigImg: PDFImage | null) {
  const { reg, bold } = fonts

  // ── Logo "IOMA" (top-right) ──
  const LOGO_FS = 32
  const logoW = bold.widthOfTextAtSize('IOMA', LOGO_FS)
  page.drawText('IOMA', {
    x: PAGE_W - ML - logoW,
    y: yb(22, LOGO_FS),
    font: bold, size: LOGO_FS, color: C_IOMA,
  })

  // ── Title bar ──
  const TITLE_TOP = 62
  const TITLE_H   = 26
  page.drawRectangle({
    x: ML, y: yb(TITLE_TOP, TITLE_H),
    width: W, height: TITLE_H,
    color: C_NAVY,
  })
  const TITLE_FS   = 9
  const titleText  = 'PLANILLA DE ASISTENCIA DIARIA  /  Conformidad del Afiliado'
  const titleTextW = bold.widthOfTextAtSize(titleText, TITLE_FS)
  page.drawText(titleText, {
    x: ML + (W - titleTextW) / 2,
    y: yb(TITLE_TOP + (TITLE_H - TITLE_FS) / 2, TITLE_FS),
    font: bold, size: TITLE_FS, color: C_WHITE,
  })

  // ── Header fields box ──
  const BOX_TOP  = 96
  const BOX_H    = 76
  const ROW_SEP  = BOX_H / 3  // ~25.3pt per row
  const MID_X    = ML + W * 0.56  // vertical separator for 2-column rows

  page.drawRectangle({
    x: ML, y: yb(BOX_TOP, BOX_H),
    width: W, height: BOX_H,
    borderColor: C_BLACK, borderWidth: 0.6,
  })

  // Horizontal dividers between rows
  for (let i = 1; i < 3; i++) {
    const divY = BOX_TOP + ROW_SEP * i
    page.drawLine({
      start: { x: ML,      y: yb(divY) },
      end:   { x: ML + W,  y: yb(divY) },
      thickness: 0.4, color: C_BLACK,
    })
  }

  // Vertical divider (rows 2 and 3)
  page.drawLine({
    start: { x: MID_X, y: yb(BOX_TOP + ROW_SEP) },
    end:   { x: MID_X, y: yb(BOX_TOP + BOX_H) },
    thickness: 0.4, color: C_BLACK,
  })

  const LBL_FS = 7.5
  const VAL_FS = 9
  const PAD    = 5

  function drawField(lbl: string, val: string, baseX: number, rowIndex: number, maxX?: number) {
    const rowMidY = BOX_TOP + ROW_SEP * rowIndex + ROW_SEP / 2
    const lblY = yb(rowMidY + LBL_FS * 0.5 + 1, LBL_FS)
    const valY = yb(rowMidY + VAL_FS * 0.5 - 5, VAL_FS)

    page.drawText(lbl, { x: baseX + PAD, y: lblY, font: reg, size: LBL_FS, color: C_DARK })

    const lblW = reg.widthOfTextAtSize(lbl + ' ', LBL_FS)
    page.drawText(val, { x: baseX + PAD + lblW, y: valY, font: bold, size: VAL_FS, color: C_BLACK })

    if (maxX) {
      const valW = bold.widthOfTextAtSize(val, VAL_FS)
      const dotX1 = baseX + PAD + lblW + valW + 3
      const dotX2 = maxX - PAD
      if (dotX2 > dotX1 + 8) {
        page.drawLine({
          start: { x: dotX1, y: valY + 1 },
          end:   { x: dotX2, y: valY + 1 },
          thickness: 0.35, color: C_MUTED,
          dashArray: [1, 2.5], dashPhase: 0,
        })
      }
    }
  }

  // Row 0: Apellido y nombre (full width)
  drawField('Apellido y nombre del afiliado:', datos.paciente, ML, 0, ML + W)

  // Row 1: N° Afiliado | Mes de prestación
  drawField('N° Afiliado:', datos.nroAfiliado, ML, 1, MID_X)
  drawField('Mes de prestación:', datos.mes, MID_X, 1, ML + W)

  // Row 2: Nombre del Profesional | Matrícula
  drawField('Nombre del Profesional:', datos.profesional, ML, 2, MID_X)
  drawField('Matrícula / Credencial:', datos.matricula, MID_X, 2, ML + W)

  // ── Table ──
  const colDefs = [
    { x: COL_DIA[0],   w: COL_DIA[1],   label: 'Día' },
    { x: COL_ENT[0],   w: COL_ENT[1],   label: 'Entrada' },
    { x: COL_SAL[0],   w: COL_SAL[1],   label: 'Salida' },
    { x: COL_FPROF[0], w: COL_FPROF[1], label: 'Firma del\nProfesional' },
    { x: COL_FAFIL[0], w: COL_FAFIL[1], label: 'Firma del\nAfiliado' },
  ]

  // Table header row
  for (const col of colDefs) {
    page.drawRectangle({
      x: col.x, y: yb(TABLE_TOP, HDR_H),
      width: col.w, height: HDR_H,
      borderColor: C_BLACK, borderWidth: 0.5,
    })
    const HDR_FS = 8
    const lines = col.label.split('\n')
    const lineH = HDR_FS + 3
    const totalH = lines.length * lineH
    const startY = TABLE_TOP + (HDR_H - totalH) / 2
    for (let li = 0; li < lines.length; li++) {
      const lw = bold.widthOfTextAtSize(lines[li], HDR_FS)
      page.drawText(lines[li], {
        x: col.x + (col.w - lw) / 2,
        y: yb(startY + li * lineH, HDR_FS),
        font: bold, size: HDR_FS, color: C_BLACK,
      })
    }
  }

  // Data rows — always draw all 31 days
  const sessionMap = new Map(datos.sesiones.map(s => [s.dia, s]))

  for (let day = 1; day <= 31; day++) {
    const rowKitY = ROWS_TOP + (day - 1) * ROW_H
    const sesion  = sessionMap.get(day) ?? null
    const hasSesion = !!sesion

    for (const col of colDefs) {
      page.drawRectangle({
        x: col.x, y: yb(rowKitY, ROW_H),
        width: col.w, height: ROW_H,
        borderColor: hasSesion ? C_BLACK : C_LIGHT,
        borderWidth: 0.4,
      })
    }

    if (!sesion) continue

    const DATA_FS  = 8
    const textKitY = rowKitY + (ROW_H - DATA_FS) / 2

    // Day number (left-aligned)
    page.drawText(String(day), {
      x: COL_DIA[0] + 4,
      y: yb(textKitY, DATA_FS),
      font: bold, size: DATA_FS, color: C_BLACK,
    })

    // Entrada (centered)
    const entW = reg.widthOfTextAtSize(sesion.entrada, DATA_FS)
    page.drawText(sesion.entrada, {
      x: COL_ENT[0] + (COL_ENT[1] - entW) / 2,
      y: yb(textKitY, DATA_FS),
      font: reg, size: DATA_FS, color: C_BLACK,
    })

    // Salida (centered)
    const salW = reg.widthOfTextAtSize(sesion.salida, DATA_FS)
    page.drawText(sesion.salida, {
      x: COL_SAL[0] + (COL_SAL[1] - salW) / 2,
      y: yb(textKitY, DATA_FS),
      font: reg, size: DATA_FS, color: C_BLACK,
    })

    // Professional signature
    if (sigImg) {
      const dims = imgScale(sigImg, COL_FPROF[1] - 4, ROW_H - 2)
      const xC   = COL_FPROF[0] + (COL_FPROF[1] - dims.width) / 2
      const yOff = (ROW_H - dims.height) / 2
      page.drawImage(sigImg, {
        x: xC,
        y: yb(rowKitY + yOff, dims.height),
        width: dims.width, height: dims.height,
      })
    }
  }

  // ── Footer (right-aligned signature block) ──
  const FOOT_TOP = ROWS_TOP + 31 * ROW_H + 10
  const FOOT_FS  = 8
  const FOOT_LH  = 13
  const BLOCK_W  = 240
  const BLOCK_X  = ML + W - BLOCK_W  // right edge

  const footerLines: { label: string; value: string }[] = [
    { label: 'Firma de afiliado o familiar:', value: '' },
    { label: 'Aclaración:', value: '' },
    { label: 'DNI:', value: datos.dni ?? '' },
    { label: 'Grado de parentesco:', value: '' },
  ]

  for (let i = 0; i < footerLines.length; i++) {
    const lineKitY = FOOT_TOP + i * FOOT_LH
    const { label, value } = footerLines[i]

    page.drawText(label, {
      x: BLOCK_X, y: yb(lineKitY, FOOT_FS),
      font: reg, size: FOOT_FS, color: C_DARK,
    })

    const lblW = reg.widthOfTextAtSize(label + ' ', FOOT_FS)
    let afterX  = BLOCK_X + lblW

    if (value) {
      page.drawText(value, {
        x: afterX, y: yb(lineKitY, FOOT_FS),
        font: bold, size: FOOT_FS, color: C_BLACK,
      })
      afterX += bold.widthOfTextAtSize(value, FOOT_FS) + 4
    }

    const lineEndX = BLOCK_X + BLOCK_W
    if (lineEndX > afterX + 10) {
      page.drawLine({
        start: { x: afterX,   y: yb(lineKitY, FOOT_FS) - 1 },
        end:   { x: lineEndX, y: yb(lineKitY, FOOT_FS) - 1 },
        thickness: 0.5, color: C_DARK,
      })
    }
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function generarPlanillaIoma(datos: DatosIoma): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    reg:  await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  }

  let sigImg: PDFImage | null = null
  if (datos.firmaProfesionalUrl) {
    const buf = await fetchImg(datos.firmaProfesionalUrl)
    if (buf) sigImg = await embedImg(pdfDoc, buf)
  }

  const page = pdfDoc.addPage([PAGE_W, PAGE_H])
  drawPage(page, fonts, datos, sigImg)

  return Buffer.from(await pdfDoc.save())
}
