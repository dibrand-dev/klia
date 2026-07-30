import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDriveClient } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: archivo } = await supabase
    .from('archivos_paciente')
    .select('google_drive_file_id, mime_type')
    .eq('id', params.id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  if (!archivo.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: 'Este endpoint solo sirve imágenes' }, { status: 400 })
  }

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token')
    .eq('terapeuta_id', user.id)
    .single()

  if (!tokens?.access_token || !tokens?.refresh_token) {
    return NextResponse.json({ error: 'Google Drive no conectado' }, { status: 400 })
  }

  try {
    const drive = getDriveClient(tokens.access_token, tokens.refresh_token)
    const res = await drive.files.get(
      { fileId: archivo.google_drive_file_id, alt: 'media' },
      { responseType: 'stream' }
    )

    const stream = res.data as NodeJS.ReadableStream
    const body = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
    })

    return new NextResponse(body, {
      headers: {
        'Content-Type': archivo.mime_type,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: unknown) {
    console.error('[archivos/contenido] Drive error:', error)
    return NextResponse.json({ error: 'Error al obtener el archivo de Drive' }, { status: 500 })
  }
}
