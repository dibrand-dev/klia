import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDriveClient, deleteFileFromDrive } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { archivoId } = await request.json() as { archivoId: string }
  if (!archivoId) return NextResponse.json({ error: 'archivoId requerido' }, { status: 400 })

  const { data: archivo } = await supabase
    .from('archivos_paciente')
    .select('*')
    .eq('id', archivoId)
    .eq('terapeuta_id', user.id)
    .single()

  if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token')
    .eq('terapeuta_id', user.id)
    .single()

  if (tokens?.access_token && tokens?.refresh_token) {
    try {
      const drive = getDriveClient(tokens.access_token, tokens.refresh_token)
      await deleteFileFromDrive(drive, archivo.google_drive_file_id)
    } catch {
      // Non-fatal: continue even if Drive delete fails
    }
  }

  await supabase.from('archivos_paciente').delete().eq('id', archivoId).eq('terapeuta_id', user.id)

  return NextResponse.json({ ok: true })
}
