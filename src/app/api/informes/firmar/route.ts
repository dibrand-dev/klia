import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Database } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getDriveClient, uploadFileToDrive } from '@/lib/google-drive'
import type { drive_v3 } from 'googleapis'

export const runtime = 'nodejs'

type DriveClient = drive_v3.Drive

function svc() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxW: number
): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue }
    const words = para.split(' ')
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur)
        cur = word
      } else {
        cur = test
      }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

async function getOrCreateInformesFolder(drive: DriveClient, apellidoPaciente: string): Promise<string> {
  const safe = (s: string) => s.replace(/'/g, "\\'")

  async function findOrCreate(name: string, parentId: string): Promise<string> {
    const res = await drive.files.list({
      q: `name='${safe(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id)',
    })
    if (res.data.files?.length) return res.data.files[0].id!
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    })
    return created.data.id!
  }

  const kliaRes = await drive.files.list({
    q: `name='KLIA' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
  })
  let kliaId: string
  if (kliaRes.data.files?.length) {
    kliaId = kliaRes.data.files[0].id!
  } else {
    const klia = await drive.files.create({
      requestBody: { name: 'KLIA', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
      fields: 'id',
    })
    kliaId = klia.data.id!
  }

  const informesId = await findOrCreate('Informes', kliaId)
  return findOrCreate(apellidoPaciente, informesId)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { informe_id: string; contenido_final: string }
  const { informe_id, contenido_final } = body
  if (!informe_id || !contenido_final) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const db = svc()

  const { data: informe } = await db.from('informes_medicos' as never)
    .select('*')
    .eq('id', informe_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!informe) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })

  const inf = informe as {
    paciente_id: string
    periodo_desde: string
    periodo_hasta: string
  }

  const [{ data: prof }, { data: paciente }] = await Promise.all([
    db.from('profiles')
      .select('nombre, apellido, matricula, especialidad, direccion, localidad, provincia, email, telefono, firma_sello_url')
      .eq('id', user.id)
      .single(),
    db.from('pacientes')
      .select('nombre, apellido')
      .eq('id', inf.paciente_id)
      .single(),
  ])

  if (!prof) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const A4_W = 595.28
  const A4_H = 841.89
  const MARGIN = 60
  const TEXT_W = A4_W - MARGIN * 2
  const C_BLACK = rgb(0, 0, 0)
  const C_DARK  = rgb(0.13, 0.13, 0.13)
  const C_GRAY  = rgb(0.4, 0.4, 0.4)
  const C_LINE  = rgb(0.75, 0.75, 0.75)

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([A4_W, A4_H])
  const fontReg  = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  const profNombre = `${prof.nombre} ${prof.apellido}`
  const espLine = [
    prof.especialidad,
    prof.matricula ? `Mat. Prof. ${prof.matricula}` : null,
  ].filter(Boolean).join('  —  ')
  const addrLine = [prof.direccion, prof.localidad, prof.provincia].filter(Boolean).join(', ')

  let y = A4_H - MARGIN

  page.drawText(profNombre, { x: MARGIN, y: y - 14, font: fontBold, size: 14, color: C_BLACK })
  y -= 20
  if (espLine) { page.drawText(espLine, { x: MARGIN, y: y - 10, font: fontReg, size: 10, color: C_DARK }); y -= 14 }
  if (addrLine) { page.drawText(addrLine, { x: MARGIN, y: y - 10, font: fontReg, size: 10, color: C_DARK }); y -= 14 }
  y -= 8
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4_W - MARGIN, y }, thickness: 0.5, color: C_LINE })
  y -= 24

  const SECTION_HEADERS = new Set([
    'INFORME MÉDICO',
    'DIAGNÓSTICO PRINCIPAL',
    'MOTIVO DEL INFORME',
    'RESUMEN DE EVOLUCIÓN CLÍNICA',
    'JUSTIFICACIÓN MÉDICA',
    'OBSERVACIONES DEL PROFESIONAL',
  ])
  const IS_LABEL_LINE = /^(Paciente:|DNI:|Fecha de nacimiento:|Obra Social|Nº de Afiliado:|Período evaluado:)/

  const LINE_H = 16
  const bodyLines = wrapText(contenido_final, fontReg, 11, TEXT_W)

  for (const line of bodyLines) {
    if (y - 11 < MARGIN + 100) {
      page = pdfDoc.addPage([A4_W, A4_H])
      y = A4_H - MARGIN
    }
    if (line === '') { y -= LINE_H * 0.5; continue }

    const isBold = SECTION_HEADERS.has(line.trim()) || IS_LABEL_LINE.test(line)
    page.drawText(line, {
      x: MARGIN,
      y: y - 11,
      font: isBold ? fontBold : fontReg,
      size: 11,
      color: C_DARK,
    })
    y -= isBold && SECTION_HEADERS.has(line.trim()) ? LINE_H + 2 : LINE_H
  }

  y -= 40
  if (y < MARGIN + 140) {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - MARGIN - 40
  }

  const cx = MARGIN + TEXT_W / 2

  if (prof.firma_sello_url) {
    try {
      const imgRes = await fetch(prof.firma_sello_url)
      const imgBuf = await imgRes.arrayBuffer()
      const ct = imgRes.headers.get('content-type') ?? ''
      const img = ct.includes('png') || prof.firma_sello_url.toLowerCase().includes('.png')
        ? await pdfDoc.embedPng(imgBuf)
        : await pdfDoc.embedJpg(imgBuf)
      const scale = Math.min(180 / img.width, 80 / img.height, 1)
      const iW = img.width * scale
      const iH = img.height * scale
      page.drawImage(img, { x: cx - iW / 2, y: y - iH, width: iW, height: iH })
      y -= iH + 8
    } catch { y -= 60 }
  } else {
    y -= 60
  }

  page.drawLine({ start: { x: cx - 90, y }, end: { x: cx + 90, y }, thickness: 0.5, color: C_LINE })
  y -= 12
  const sigW = fontBold.widthOfTextAtSize(profNombre, 11)
  page.drawText(profNombre, { x: cx - sigW / 2, y: y - 11, font: fontBold, size: 11, color: C_BLACK })
  y -= 16
  if (espLine) {
    const espW = fontReg.widthOfTextAtSize(espLine, 9)
    page.drawText(espLine, { x: cx - espW / 2, y: y - 9, font: fontReg, size: 9, color: C_DARK })
    y -= 13
  }
  const fechaFirma = `${prof.localidad ? `${prof.localidad}, ` : ''}${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`
  const fechaStr = `Fecha de emisión: ${fechaFirma}`
  const fW2 = fontReg.widthOfTextAtSize(fechaStr, 9)
  page.drawText(fechaStr, { x: cx - fW2 / 2, y: y - 9, font: fontReg, size: 9, color: C_GRAY })

  page.drawLine({ start: { x: MARGIN, y: MARGIN + 16 }, end: { x: A4_W - MARGIN, y: MARGIN + 16 }, thickness: 0.5, color: C_LINE })
  const footerParts = [
    prof.telefono ? `Cel.: ${prof.telefono}` : null,
    prof.email ? `e-mail: ${prof.email}` : null,
  ].filter(Boolean).join('  ·  ')
  if (footerParts) {
    const fW = fontReg.widthOfTextAtSize(footerParts, 9)
    page.drawText(footerParts, { x: A4_W / 2 - fW / 2, y: MARGIN, font: fontReg, size: 9, color: C_GRAY })
  }

  const pdfBytes = await pdfDoc.save()
  const pdfBuffer = Buffer.from(pdfBytes)

  const apellidoPac = paciente?.apellido ?? 'Paciente'
  const nombreArchivo = `Informe_${apellidoPac}_${inf.periodo_desde}_${inf.periodo_hasta}.pdf`

  let pdfUrl: string | null = null
  let pdfFileId: string | null = null

  try {
    const { data: tokens } = await db.from('google_calendar_tokens' as never)
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .single()

    const t = tokens as { access_token: string; refresh_token: string } | null
    if (t?.access_token && t?.refresh_token) {
      const drive = getDriveClient(t.access_token, t.refresh_token)
      const folderId = await getOrCreateInformesFolder(drive, apellidoPac)
      const result = await uploadFileToDrive(drive, pdfBuffer, nombreArchivo, 'application/pdf', folderId)
      pdfUrl = result.url
      pdfFileId = result.fileId
    }
  } catch {
    // Drive not connected — PDF returned directly
  }

  await db.from('informes_medicos' as never).update({
    estado: 'firmado',
    contenido_generado: contenido_final,
    pdf_drive_url: pdfUrl,
    pdf_drive_file_id: pdfFileId,
    firmado_at: new Date().toISOString(),
  }).eq('id', informe_id)

  if (pdfUrl) {
    return NextResponse.json({ pdf_url: pdfUrl, informe_id })
  }

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'X-Informe-Id': informe_id,
    },
  })
}
