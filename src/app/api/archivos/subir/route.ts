import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDriveClient, getOrCreatePatientFolder, uploadFileToDrive } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  console.log('Step 1: Getting tokens...')
  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token')
    .eq('terapeuta_id', user.id)
    .single()

  if (!tokens?.access_token || !tokens?.refresh_token) {
    return NextResponse.json({ error: 'Google Drive no conectado' }, { status: 400 })
  }
  console.log('Step 1 OK: tokens found')

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

  console.log('Step 2: Getting patient...', pacienteId)
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', user.id)
    .single()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
  console.log('Step 2 OK: patient found')

  let fileId: string
  let url: string
  try {
    console.log('Step 3: Getting Drive client...')
    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClient(tokens.access_token, tokens.refresh_token)
    console.log('Step 3 OK')

    console.log('Step 4: Getting/creating folder...')
    const folderId = await getOrCreatePatientFolder(drive, pacienteNombre, categoria)
    console.log('Step 4 OK: folderId', folderId)

    console.log('Step 5: Uploading file...', file.name, file.size)
    const result = await uploadFileToDrive(drive, buffer, file.name, file.type, folderId)
    fileId = result.fileId
    url = result.url
    console.log('Step 5 OK: fileId', fileId)
  } catch (error: unknown) {
    const err = error as Record<string, unknown>
    console.error('Drive upload error:', error)
    return NextResponse.json({
      error: 'Error al subir archivo',
      detail: err?.message ?? String(error),
      code: err?.code,
      status: err?.status,
    }, { status: 500 })
  }

  console.log('Step 6: Saving to DB...')
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
    return NextResponse.json({ error: 'Error al guardar en base de datos', detail: dbError.message }, { status: 500 })
  }

  console.log('Step 6 OK: archivo saved')
  return NextResponse.json({ archivo })
}
