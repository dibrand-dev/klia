import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SesionSwissMedical {
  fecha: string    // "DD/MM"
  horario: string  // "HH:MM"
}

export interface DatosSwissMedical {
  mes: string
  anio: string
  paciente: string
  dni: string
  tipoTratamiento: string
  profesional: string
  sesiones: SesionSwissMedical[]
  firmaPacienteUrl?: string    // paciente.firma_paciente_url → tabla "Firma del Socio Padre/Tutor"
  firmaProfesionalUrl?: string // profile.firma_url           → pie "Firma del Profesional"
  selloUrl?: string            // profile.firma_sello_url     → pie "Sello"
  matricula: string
}

// ── Page constants ───────────────────────────────────────────────────────────

const PAGE_H = 841.89
const PAGE_W = 595.28
const ML = 40
const W  = PAGE_W - 2 * ML  // 515.28

// Column layout
const COL_FECHA   = { x: ML,        w: 62 }
const COL_HORARIO = { x: ML + 62,   w: 65 }
const COL_FIRMA   = { x: ML + 127,  w: 155 }
const COL_ACLAR   = { x: ML + 282,  w: 115 }
const COL_OBS     = { x: ML + 397,  w: PAGE_W - ML - (ML + 397) }  // 118.28

const TABLE_TOP  = 140
const HDR_H      = 28
const ROW_H      = 22
const MAX_ROWS   = 26
const ROWS_TOP   = TABLE_TOP + HDR_H  // 168

// Colors
const C_RED   = rgb(0.80, 0.01, 0.01)
const C_BLACK = rgb(0,    0,    0)
const C_DARK  = rgb(0.20, 0.20, 0.20)
const C_GRAY  = rgb(0.60, 0.60, 0.60)

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
interface ImgCache { paciente: PDFImage | null; firma: PDFImage | null; sello: PDFImage | null }

// ── Logo ─────────────────────────────────────────────────────────────────────

function drawLogo(page: PDFPage, fonts: Fonts) {
  const SQ = 10
  const GAP = 3
  const markW = SQ * 2 + GAP
  const markX = PAGE_W / 2 - markW / 2

  // 2×2 red squares
  page.drawRectangle({ x: markX,         y: yb(16, SQ), width: SQ, height: SQ, color: C_RED })
  page.drawRectangle({ x: markX + SQ + GAP, y: yb(16, SQ), width: SQ, height: SQ, color: C_RED })
  page.drawRectangle({ x: markX,         y: yb(16 + SQ + GAP, SQ), width: SQ, height: SQ, color: C_RED })
  page.drawRectangle({ x: markX + SQ + GAP, y: yb(16 + SQ + GAP, SQ), width: SQ, height: SQ, color: C_RED })

  // "SWISS MEDICAL"
  const SM_FS = 16
  const smW = fonts.bold.widthOfTextAtSize('SWISS MEDICAL', SM_FS)
  page.drawText('SWISS MEDICAL', {
    x: PAGE_W / 2 - smW / 2,
    y: yb(46, SM_FS),
    font: fonts.bold, size: SM_FS, color: C_DARK,
  })

  // "MEDICINA PRIVADA"
  const MP_FS = 7
  const mpW = fonts.reg.widthOfTextAtSize('MEDICINA PRIVADA', MP_FS)
  page.drawText('MEDICINA PRIVADA', {
    x: PAGE_W / 2 - mpW / 2,
    y: yb(63, MP_FS),
    font: fonts.reg, size: MP_FS, color: C_GRAY,
  })
}

// ── Page renderer ─────────────────────────────────────────────────────────────

function drawPage(page: PDFPage, fonts: Fonts, datos: DatosSwissMedical, imgs: ImgCache) {
  const { reg, bold } = fonts

  drawLogo(page, fonts)

  // ── Title ──
  const T_FS = 11
  const titleW = bold.widthOfTextAtSize('PLANILLA DE ASISTENCIA - ANEXO V', T_FS)
  page.drawText('PLANILLA DE ASISTENCIA - ANEXO V', {
    x: PAGE_W / 2 - titleW / 2,
    y: yb(77, T_FS),
    font: bold, size: T_FS, color: C_RED,
  })

  // ── Header fields ──
  const F_FS = 8.5

  function drawField(lbl: string, val: string, x: number, kitY: number) {
    page.drawText(lbl, { x, y: yb(kitY, F_FS), font: reg, size: F_FS, color: C_DARK })
    page.drawText(val,  { x: x + reg.widthOfTextAtSize(lbl, F_FS), y: yb(kitY, F_FS), font: bold, size: F_FS, color: C_BLACK })
  }

  // Line 1: Mes / Año
  drawField('Mes: ', datos.mes, ML, 95)
  const mesEndX = ML + reg.widthOfTextAtSize('Mes: ', F_FS) + bold.widthOfTextAtSize(datos.mes, F_FS) + 14
  drawField('Año: ', datos.anio, mesEndX, 95)

  // Line 2: Nombre/Apellido + DNI
  drawField('Nombre/s y Apellido/s del Paciente: ', datos.paciente, ML, 110)
  const dniLbl = 'DNI Nº: '
  const dniX = PAGE_W - ML - bold.widthOfTextAtSize(datos.dni, F_FS) - reg.widthOfTextAtSize(dniLbl, F_FS)
  drawField(dniLbl, datos.dni, dniX, 110)

  // Line 3: Tipo de Tratamiento + Profesional
  drawField('Tipo de Tratamiento: ', datos.tipoTratamiento, ML, 125)
  const halfX = ML + W * 0.50
  drawField('Profesional a cargo: ', datos.profesional, halfX, 125)

  // ── Table header ──
  const colDefs = [
    { ...COL_FECHA,   label: 'Fecha' },
    { ...COL_HORARIO, label: 'Horario\nde la Sesión' },
    { ...COL_FIRMA,   label: 'Firma del Socio Padre/Tutor' },
    { ...COL_ACLAR,   label: 'Aclaración' },
    { ...COL_OBS,     label: 'Observaciones' },
  ]

  for (const col of colDefs) {
    page.drawRectangle({
      x: col.x, y: yb(TABLE_TOP, HDR_H),
      width: col.w, height: HDR_H,
      borderColor: C_RED, borderWidth: 0.8,
    })
    const H_FS  = 7.5
    const lines = col.label.split('\n')
    const lineH = H_FS + 3
    const totalH = lines.length * lineH
    const startY = TABLE_TOP + (HDR_H - totalH) / 2
    for (let li = 0; li < lines.length; li++) {
      const lw = bold.widthOfTextAtSize(lines[li], H_FS)
      page.drawText(lines[li], {
        x: col.x + (col.w - lw) / 2,
        y: yb(startY + li * lineH, H_FS),
        font: bold, size: H_FS, color: C_BLACK,
      })
    }
  }

  // ── Data rows ──
  const D_FS = 8

  for (let i = 0; i < MAX_ROWS; i++) {
    const rowKitY = ROWS_TOP + i * ROW_H
    const sesion  = datos.sesiones[i] ?? null

    for (const col of colDefs) {
      page.drawRectangle({
        x: col.x, y: yb(rowKitY, ROW_H),
        width: col.w, height: ROW_H,
        borderColor: C_RED, borderWidth: 0.5,
      })
    }

    const textKitY = rowKitY + (ROW_H - D_FS) / 2

    if (sesion) {
      // Fecha centered
      const fW = reg.widthOfTextAtSize(sesion.fecha, D_FS)
      page.drawText(sesion.fecha, {
        x: COL_FECHA.x + (COL_FECHA.w - fW) / 2,
        y: yb(textKitY, D_FS),
        font: reg, size: D_FS, color: C_BLACK,
      })
      // Horario centered
      const hW = reg.widthOfTextAtSize(sesion.horario, D_FS)
      page.drawText(sesion.horario, {
        x: COL_HORARIO.x + (COL_HORARIO.w - hW) / 2,
        y: yb(textKitY, D_FS),
        font: reg, size: D_FS, color: C_BLACK,
      })
      // Patient signature
      if (imgs.paciente) {
        const dims = imgScale(imgs.paciente, COL_FIRMA.w - 4, ROW_H - 2)
        page.drawImage(imgs.paciente, {
          x: COL_FIRMA.x + (COL_FIRMA.w - dims.width) / 2,
          y: yb(rowKitY + (ROW_H - dims.height) / 2, dims.height),
          width: dims.width, height: dims.height,
        })
      }
    } else {
      // Empty placeholders in gray
      const slashW = reg.widthOfTextAtSize('/ /', D_FS)
      page.drawText('/ /', {
        x: COL_FECHA.x + (COL_FECHA.w - slashW) / 2,
        y: yb(textKitY, D_FS),
        font: reg, size: D_FS, color: C_GRAY,
      })
      const colonW = reg.widthOfTextAtSize(':', D_FS)
      page.drawText(':', {
        x: COL_HORARIO.x + (COL_HORARIO.w - colonW) / 2,
        y: yb(textKitY, D_FS),
        font: reg, size: D_FS, color: C_GRAY,
      })
    }
  }

  // ── Footer ──
  const FOOT_LINE_Y = ROWS_TOP + MAX_ROWS * ROW_H + 22  // kitY of the underline
  const SECT_W      = W / 3                              // 171.76
  const LINE_W      = 145
  const LINE_OFF    = (SECT_W - LINE_W) / 2             // offset within section

  const footerSections = [
    { label: 'Firma del Profesional', img: imgs.firma },
    { label: 'Matricula Nº',          img: null },
    { label: 'Sello',                 img: imgs.sello },
  ]

  footerSections.forEach((sec, i) => {
    const lineX = ML + SECT_W * i + LINE_OFF

    // Image above line (signature or sello)
    if (sec.img) {
      const dims = imgScale(sec.img, LINE_W - 4, 26)
      page.drawImage(sec.img, {
        x: lineX + (LINE_W - dims.width) / 2,
        y: yb(FOOT_LINE_Y - 4, dims.height),
        width: dims.width, height: dims.height,
      })
    }

    // Matrícula text above line
    if (sec.label === 'Matricula Nº' && datos.matricula) {
      const M_FS = 8
      const mW = reg.widthOfTextAtSize(datos.matricula, M_FS)
      page.drawText(datos.matricula, {
        x: lineX + (LINE_W - mW) / 2,
        y: yb(FOOT_LINE_Y - 8, M_FS),
        font: reg, size: M_FS, color: C_BLACK,
      })
    }

    // Underline
    page.drawLine({
      start: { x: lineX,           y: yb(FOOT_LINE_Y) },
      end:   { x: lineX + LINE_W,  y: yb(FOOT_LINE_Y) },
      thickness: 0.5, color: C_DARK,
    })

    // Label below line
    const L_FS = 7.5
    const lW = reg.widthOfTextAtSize(sec.label, L_FS)
    page.drawText(sec.label, {
      x: lineX + (LINE_W - lW) / 2,
      y: yb(FOOT_LINE_Y + 11, L_FS),
      font: reg, size: L_FS, color: C_DARK,
    })
  })

  // Regulatory text at bottom
  const REG_FS  = 6
  const regText = 'SUPERINTENDENCIA DE SERVICIOS DE SALUD - ÓRGANO DE CONTROL - O800-222-SALUD (72583) - www.sssalud.gob.ar - RNEMP Nº: 1332'
  const regW    = reg.widthOfTextAtSize(regText, REG_FS)
  page.drawText(regText, {
    x: PAGE_W / 2 - regW / 2,
    y: yb(PAGE_H - 14, REG_FS),
    font: reg, size: REG_FS, color: C_GRAY,
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generarPlanillaSwissMedical(datos: DatosSwissMedical): Promise<Buffer> {
  // Fetch all images in parallel
  const [bufPaciente, bufFirma, bufSello] = await Promise.all([
    datos.firmaPacienteUrl    ? fetchImg(datos.firmaPacienteUrl)    : Promise.resolve(null),
    datos.firmaProfesionalUrl ? fetchImg(datos.firmaProfesionalUrl) : Promise.resolve(null),
    datos.selloUrl            ? fetchImg(datos.selloUrl)            : Promise.resolve(null),
  ])

  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    reg:  await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  }

  const imgs: ImgCache = {
    paciente: bufPaciente ? await embedImg(pdfDoc, bufPaciente) : null,
    firma:    bufFirma    ? await embedImg(pdfDoc, bufFirma)    : null,
    sello:    bufSello    ? await embedImg(pdfDoc, bufSello)    : null,
  }

  // Page 1: rows 0-25
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H])
  drawPage(page1, fonts, { ...datos, sesiones: datos.sesiones.slice(0, MAX_ROWS) }, imgs)

  // Page 2 if needed (> 26 sessions)
  if (datos.sesiones.length > MAX_ROWS) {
    const page2 = pdfDoc.addPage([PAGE_W, PAGE_H])
    drawPage(page2, fonts, { ...datos, sesiones: datos.sesiones.slice(MAX_ROWS, MAX_ROWS * 2) }, imgs)
  }

  return Buffer.from(await pdfDoc.save())
}
