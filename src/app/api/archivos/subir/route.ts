import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDriveClient, getOrCreatePatientFolder, uploadFileToDrive } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token')
    .eq('terapeuta_id', user.id)
    .single()

  if (!tokens?.access_token || !tokens?.refresh_token) {
    return NextResponse.json({ error: 'Google Drive no conectado' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const pacienteId = formData.get('pacienteId') as string | null
  const pacienteNombre = formData.get('pacienteNombre') as string | null
  const categoria = formData.get('categoria') as string | null
  const fechaEstudio = formData.get('fechaEstudio') as string | null
  const descripcion = formData.get('descripcion') as string | null

  if (!file || !pacienteId || !pacienteNombre || !categoria) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', user.id)
    .single()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  let fileId: string
  let url: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClient(tokens.access_token, tokens.refresh_token)
    const folderId = await getOrCreatePatientFolder(drive, pacienteNombre, categoria)
    const result = await uploadFileToDrive(drive, buffer, file.name, file.type, folderId)
    fileId = result.fileId
    url = result.url
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[archivos/subir] Drive error:', msg)
    return NextResponse.json({ error: `Error al subir a Google Drive: ${msg}` }, { status: 500 })
  }

  const { data: archivo, error: dbError } = await supabase
    .from('archivos_paciente')
    .insert({
      paciente_id: pacienteId,
      terapeuta_id: user.id,
      nombre: file.name,
      categoria,
      google_drive_file_id: fileId,
      google_drive_url: url,
      mime_type: file.type,
      tamanio_bytes: file.size,
      fecha_estudio: fechaEstudio || null,
      descripcion: descripcion || null,
    })
    .select()
    .single()

  if (dbError) {
    console.error('[archivos/subir] DB error:', dbError)
    return NextResponse.json({ error: 'Error al guardar en base de datos' }, { status: 500 })
  }

  return NextResponse.json({ archivo })
}
