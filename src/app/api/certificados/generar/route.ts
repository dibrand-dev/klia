import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Database } from '@/types/database'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const runtime = 'nodejs'

type PDFFont = Awaited<ReturnType<PDFDocument['embedFont']>>

function svc() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function formatFecha(dateStr: string): string {
  return format(parseISO(dateStr), "d 'de' MMMM 'de' yyyy", { locale: es })
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
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
    lines.push(cur)
  }
  return lines
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    paciente_id: string
    fecha_emision: string
    destinatario: string
    cuerpo_texto: string
  }
  const { paciente_id, fecha_emision, destinatario, cuerpo_texto } = body
  if (!paciente_id || !fecha_emision || !destinatario || !cuerpo_texto) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const db = svc()

  const [{ data: paciente }, { data: profRaw }] = await Promise.all([
    db.from('pacientes').select('nombre, apellido, dni').eq('id', paciente_id).eq('terapeuta_id', user.id).single(),
    db.from('profiles').select('nombre, apellido, especialidad, matricula, direccion, localidad, provincia, email, telefono, firma_sello_url').eq('id', user.id).single(),
  ])

  if (!paciente || !profRaw) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  const p = profRaw as Record<string, unknown>

  // Audit trail
  await db.from('certificados').insert({
    terapeuta_id: user.id,
    paciente_id,
    tipo: 'asistencia',
    contenido_texto: cuerpo_texto,
    fecha_emision,
  } as never)

  // ── PDF ────────────────────────────────────────────────────────────────────
  const A4_W = 595.28
  const A4_H = 841.89
  const MARGIN = 60
  const TEXT_W = A4_W - MARGIN * 2

  const C_BLACK = rgb(0, 0, 0)
  const C_DARK  = rgb(0.13, 0.13, 0.13)
  const C_GRAY  = rgb(0.4, 0.4, 0.4)
  const C_LINE  = rgb(0.75, 0.75, 0.75)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([A4_W, A4_H])

  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Y tracks position from BOTTOM; we start near the top
  let y = A4_H - MARGIN

  const profNombre = `${p.nombre as string} ${p.apellido as string}`
  const espLine = [
    p.especialidad as string | null,
    p.matricula ? `Mat. Prof. ${p.matricula as string}` : null,
  ].filter(Boolean).join('  —  ')
  const addrLine = [
    p.direccion as string | null,
    p.localidad as string | null,
    p.provincia as string | null,
  ].filter(Boolean).join(', ')

  // Header — professional name
  page.drawText(profNombre, { x: MARGIN, y: y - 14, font: fontBold, size: 14, color: C_BLACK })
  y -= 14 + 5

  // Specialty + mat
  if (espLine) {
    page.drawText(espLine, { x: MARGIN, y: y - 10, font: fontReg, size: 10, color: C_DARK })
    y -= 10 + 4
  }

  // Address
  if (addrLine) {
    page.drawText(addrLine, { x: MARGIN, y: y - 10, font: fontReg, size: 10, color: C_DARK })
    y -= 10 + 4
  }

  y -= 12

  // Separator
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4_W - MARGIN, y }, thickness: 0.5, color: C_LINE })
  y -= 22

  // Date — right aligned
  const localidadPrefix = p.localidad ? `${p.localidad as string}, ` : ''
  const dateStr = `${localidadPrefix}${formatFecha(fecha_emision)}`
  const dateW = fontReg.widthOfTextAtSize(dateStr, 11)
  page.drawText(dateStr, { x: A4_W - MARGIN - dateW, y: y - 11, font: fontReg, size: 11, color: C_DARK })
  y -= 11 + 24

  // Recipient
  const recipientStr = `${destinatario}:`
  page.drawText(recipientStr, { x: MARGIN, y: y - 11, font: fontBold, size: 11, color: C_BLACK })
  y -= 11 + 20

  // Body text
  const LINE_H = Math.round(11 * 1.6)
  const bodyLines = wrapText(cuerpo_texto, fontReg, 11, TEXT_W)
  for (const line of bodyLines) {
    page.drawText(line, { x: MARGIN, y: y - 11, font: fontReg, size: 11, color: C_DARK })
    y -= LINE_H
  }

  // Signature block — positioned 60pt below body text
  y -= 50

  const cx = MARGIN + TEXT_W / 2

  // Firma sello image
  const firmaSelloUrl = p.firma_sello_url as string | null
  if (firmaSelloUrl) {
    try {
      const imgRes = await fetch(firmaSelloUrl)
      const imgBuf = await imgRes.arrayBuffer()
      const ct = imgRes.headers.get('content-type') ?? ''
      const img = ct.includes('png') || firmaSelloUrl.toLowerCase().includes('.png')
        ? await pdfDoc.embedPng(imgBuf)
        : await pdfDoc.embedJpg(imgBuf)
      const maxW = 180
      const maxH = 80
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const iW = img.width * scale
      const iH = img.height * scale
      page.drawImage(img, { x: cx - iW / 2, y: y - iH, width: iW, height: iH })
      y -= iH + 8
    } catch {
      y -= 60 // blank space for manual signature
    }
  } else {
    y -= 60 // blank space for manual signature
  }

  // Signature line
  page.drawLine({ start: { x: cx - 90, y }, end: { x: cx + 90, y }, thickness: 0.5, color: C_LINE })
  y -= 10

  // Prof name centered under line
  const sigNameW = fontBold.widthOfTextAtSize(profNombre, 11)
  page.drawText(profNombre, { x: cx - sigNameW / 2, y: y - 11, font: fontBold, size: 11, color: C_BLACK })
  y -= 11 + 4

  if (espLine) {
    const espW = fontReg.widthOfTextAtSize(espLine, 9)
    page.drawText(espLine, { x: cx - espW / 2, y: y - 9, font: fontReg, size: 9, color: C_DARK })
  }

  // Footer — at bottom
  const footerParts = [
    p.telefono ? `Cel.: ${p.telefono as string}` : null,
    p.email ? `e-mail: ${p.email as string}` : null,
  ].filter(Boolean).join('  ·  ')

  const footerBaseY = MARGIN
  page.drawLine({
    start: { x: MARGIN, y: footerBaseY + 16 },
    end: { x: A4_W - MARGIN, y: footerBaseY + 16 },
    thickness: 0.5,
    color: C_LINE,
  })
  if (footerParts) {
    const fW = fontReg.widthOfTextAtSize(footerParts, 9)
    page.drawText(footerParts, {
      x: A4_W / 2 - fW / 2,
      y: footerBaseY,
      font: fontReg,
      size: 9,
      color: C_GRAY,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const filename = `Certificado_${paciente.apellido}_${fecha_emision}.pdf`
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
