import PDFDocument from 'pdfkit'

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
  logoUrl?: string     // URL del logo de la OS en Supabase Storage
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

// Page layout constants
const L = 40    // left margin
const R = 555   // right margin (595 - 40)
const W = 515   // content width

// Table column definitions
const COL_X   = [40,  120, 210, 310, 430]
const COL_W   = [80,   90, 100, 120, 125]
const COL_HDR = [
  'DIA / MES',
  'HORA DE INICIO',
  'HORA DE\nFINALIZACIÓN',
  'FIRMA Y SELLO\nDEL PROFESIONAL',
  'FIRMA Y ACLARACIÓN\nDEL BENEF/PADRE/TUTOR',
]

const ROW_H = 40
const HDR_H = 28

// ── helpers ────────────────────────────────────────────────────────────────

function labeledLine(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  const FS = 9
  doc.font('Helvetica').fontSize(FS).fillColor('#222222')
  doc.text(label, x, y, { lineBreak: false })

  const labelW = doc.widthOfString(label)
  doc.font('Helvetica-Bold').fontSize(FS)
  const valW = doc.widthOfString(value)

  const dotX1 = x + labelW + 4
  const dotX2 = x + width - valW - 4
  if (dotX2 > dotX1 + 4) {
    doc.save()
    doc.dash(1, { space: 2.5 }).strokeColor('#999999').lineWidth(0.4)
    doc.moveTo(dotX1, y + FS - 1).lineTo(dotX2, y + FS - 1).stroke()
    doc.restore()
  }

  doc.fillColor('#000000')
  doc.text(value, x + width - valW, y, { lineBreak: false })
}

function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
  for (let i = 0; i < 5; i++) {
    doc.rect(COL_X[i], y, COL_W[i], HDR_H).stroke()
    doc.text(COL_HDR[i], COL_X[i] + 2, y + 4, {
      width: COL_W[i] - 4,
      align: 'center',
    })
  }
}

function drawRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  sesion: SesionPlanilla | null,
  imgCache: Record<string, Buffer | null>,
) {
  // Cell borders
  for (let i = 0; i < 5; i++) {
    doc.rect(COL_X[i], y, COL_W[i], ROW_H).strokeColor('#000000').lineWidth(0.5).stroke()
  }

  if (!sesion) {
    // Dotted line in DIA/MES column for empty row
    doc.save()
    doc.dash(1, { space: 2.5 }).strokeColor('#cccccc').lineWidth(0.4)
    const midY = y + ROW_H / 2
    doc.moveTo(COL_X[0] + 6, midY).lineTo(COL_X[0] + COL_W[0] - 6, midY).stroke()
    doc.restore()
    return
  }

  doc.font('Helvetica').fontSize(10).fillColor('#000000')

  // DIA/MES
  doc.text(`${sesion.dia}/${sesion.mes}`, COL_X[0], y + ROW_H / 2 - 6, {
    width: COL_W[0],
    align: 'center',
    lineBreak: false,
  })

  // HORA INICIO
  doc.text(sesion.horaInicio, COL_X[1], y + ROW_H / 2 - 6, {
    width: COL_W[1],
    align: 'center',
    lineBreak: false,
  })

  // HORA FIN
  doc.text(sesion.horaFin, COL_X[2], y + ROW_H / 2 - 6, {
    width: COL_W[2],
    align: 'center',
    lineBreak: false,
  })

  // FIRMA PROFESIONAL
  const profUrl = sesion.firmaProfesionalUrl
  if (profUrl && imgCache[profUrl]) {
    try {
      doc.image(imgCache[profUrl]!, COL_X[3] + 4, y + 3, {
        fit: [COL_W[3] - 8, ROW_H - 6],
      })
    } catch { /* skip corrupt images */ }
  }

  // FIRMA PACIENTE
  const pacUrl = sesion.firmaPacienteUrl
  if (pacUrl && imgCache[pacUrl]) {
    try {
      doc.image(imgCache[pacUrl]!, COL_X[4] + 4, y + 3, {
        fit: [COL_W[4] - 8, ROW_H - 6],
      })
    } catch { /* skip corrupt images */ }
  }
}

function drawLogoPlaceholder(doc: InstanceType<typeof PDFDocument>) {
  doc.fontSize(9).fillColor('#2d6a4f').font('Helvetica-Bold')
  doc.text('HOSPITAL ITALIANO', L, 40, { lineBreak: false })
  doc.fontSize(7).font('Helvetica')
  doc.text('de Buenos Aires', L, 52, { lineBreak: false })
  doc.text('PLAN DE SALUD', L, 62, { lineBreak: false })
}

function renderFirstPage(
  doc: InstanceType<typeof PDFDocument>,
  datos: DatosPlanilla,
  imgCache: Record<string, Buffer | null>,
) {
  // ── Logo / placeholder ────────────────────────────────────────────────
  const logoUrl = datos.logoUrl
  const logoBuf = logoUrl ? imgCache[logoUrl] : null

  if (logoBuf) {
    try {
      doc.image(logoBuf, L, 36, { fit: [120, 50] })
    } catch {
      drawLogoPlaceholder(doc)
    }
  } else {
    drawLogoPlaceholder(doc)
  }

  // ── Título ────────────────────────────────────────────────────────────
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12)
  doc.text(
    'PLANILLA DE ASISTENCIA A TRATAMIENTOS  AÑO ' + datos.anio,
    L, 82,
    { width: W, align: 'center', underline: true, lineBreak: false },
  )

  // ── Subtítulo ─────────────────────────────────────────────────────────
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#333333')
  doc.text(
    'Adjuntar esta documentación en “original” junto a la factura o recibo que emita.',
    L, 100,
    { width: W, align: 'center', lineBreak: false },
  )

  // ── Campos ────────────────────────────────────────────────────────────
  const FY = 122
  const FH = 18

  labeledLine(doc, L, FY,      W, 'Nombre y apellido del prestador/Razón Social:', datos.prestador)
  labeledLine(doc, L, FY+FH,   W, 'Domicilio donde realiza la Prestación:', datos.domicilio)

  // Campo 3: afiliado + n° socio (inline)
  const y3 = FY + FH * 2
  const FS = 9
  doc.font('Helvetica').fontSize(FS).fillColor('#222222')
  doc.text('Dejo constancia que el afiliado', L, y3, { lineBreak: false })
  const lw3 = doc.widthOfString('Dejo constancia que el afiliado')
  doc.font('Helvetica-Bold').fontSize(FS).fillColor('#000000')
  doc.text('  ' + datos.afiliado + ' ', L + lw3, y3, { lineBreak: false })
  const vw3 = doc.widthOfString('  ' + datos.afiliado + ' ')
  doc.font('Helvetica').fillColor('#222222')
  doc.text('n° socio', L + lw3 + vw3, y3, { lineBreak: false })
  const lw3b = doc.widthOfString('n° socio')
  doc.font('Helvetica-Bold').fillColor('#000000')
  doc.text('  ' + datos.numeroSocio, L + lw3 + vw3 + lw3b, y3, { lineBreak: false })

  // Campo 4: tratamiento + mes (inline)
  const y4 = FY + FH * 3
  doc.font('Helvetica').fontSize(FS).fillColor('#222222')
  doc.text('Ha concurrido a tratamiento de', L, y4, { lineBreak: false })
  const lw4 = doc.widthOfString('Ha concurrido a tratamiento de')
  doc.font('Helvetica-Bold').fillColor('#000000')
  doc.text('  ' + datos.tratamiento + ' ', L + lw4, y4, { lineBreak: false })
  const vw4 = doc.widthOfString('  ' + datos.tratamiento + ' ')
  doc.font('Helvetica').fillColor('#222222')
  doc.text('durante el mes de', L + lw4 + vw4, y4, { lineBreak: false })
  const lw4b = doc.widthOfString('durante el mes de')
  doc.font('Helvetica-Bold').fillColor('#000000')
  doc.text('  ' + datos.mes + '  202' + datos.anio.slice(-1), L + lw4 + vw4 + lw4b, y4, { lineBreak: false })

  labeledLine(doc, L, FY + FH * 4, W, 'N° de autorización:', datos.numeroAutorizacion)

  // ── Tabla ─────────────────────────────────────────────────────────────
  const tableY = FY + FH * 5 + 8
  drawTableHeader(doc, tableY)

  const p1Rows = Math.min(datos.sesiones.length, 12)
  console.log(`[planilla] página 1: ${p1Rows} sesiones en ${12} filas`)
  let rowY = tableY + HDR_H
  for (let i = 0; i < 12; i++) {
    drawRow(doc, rowY, datos.sesiones[i] ?? null, imgCache)
    rowY += ROW_H
  }
}

function renderContinuationPage(
  doc: InstanceType<typeof PDFDocument>,
  sesiones: SesionPlanilla[],
  imgCache: Record<string, Buffer | null>,
) {
  drawTableHeader(doc, 40)
  let rowY = 40 + HDR_H
  const maxRows = 18
  for (let i = 0; i < maxRows; i++) {
    drawRow(doc, rowY, sesiones[i] ?? null, imgCache)
    rowY += ROW_H
  }
}

// ── main export ─────────────────────────────────────────────────────────────

export async function generarPlanillaHospitalItaliano(datos: DatosPlanilla): Promise<Buffer> {
  console.log(`[planilla] sesiones recibidas: ${datos.sesiones.length}`)

  // Collect unique image URLs and pre-fetch
  const allUrls: string[] = []
  if (datos.logoUrl) allUrls.push(datos.logoUrl)
  for (const s of datos.sesiones) {
    if (s.firmaProfesionalUrl && !allUrls.includes(s.firmaProfesionalUrl)) allUrls.push(s.firmaProfesionalUrl)
    if (s.firmaPacienteUrl && !allUrls.includes(s.firmaPacienteUrl)) allUrls.push(s.firmaPacienteUrl)
  }
  const imgCache: Record<string, Buffer | null> = {}
  await Promise.all(allUrls.map(async (url) => { imgCache[url] = await fetchImg(url) }))
  if (datos.logoUrl) {
    console.log(`[planilla] logo fetch result: ${imgCache[datos.logoUrl] ? 'ok' : 'failed/null'}`)
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    try {
      renderFirstPage(doc, datos, imgCache)

      if (datos.sesiones.length > 12) {
        doc.addPage()
        renderContinuationPage(doc, datos.sesiones.slice(12), imgCache)
      }
    } catch (err) {
      reject(err)
      return
    }

    doc.end()
  })
}
