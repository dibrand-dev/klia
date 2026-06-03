import { google } from 'googleapis'

export function getDriveClient(accessToken: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

type DriveClient = ReturnType<typeof getDriveClient>

async function getOrCreateFolder(drive: DriveClient, nombre: string, parentId: string): Promise<string> {
  const safe = nombre.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `name='${safe}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  if (res.data.files?.length) return res.data.files[0].id!
  const folder = await drive.files.create({
    requestBody: { name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  })
  return folder.data.id!
}

const CATEGORIAS: Record<string, string> = {
  laboratorio: 'Laboratorio',
  imagenes: 'Imágenes',
  documentos: 'Documentos',
  otros: 'Otros',
}

export async function getOrCreatePatientFolder(
  drive: DriveClient,
  pacienteNombre: string,
  categoria: string
): Promise<string> {
  const rootRes = await drive.files.list({
    q: `name='KLIA' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
  })
  let kliaId: string
  if (rootRes.data.files?.length) {
    kliaId = rootRes.data.files[0].id!
  } else {
    const klia = await drive.files.create({
      requestBody: { name: 'KLIA', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
      fields: 'id',
    })
    kliaId = klia.data.id!
  }
  const pacientesId = await getOrCreateFolder(drive, 'Pacientes', kliaId)
  const pacienteId = await getOrCreateFolder(drive, pacienteNombre, pacientesId)
  return getOrCreateFolder(drive, CATEGORIAS[categoria] ?? 'Otros', pacienteId)
}

export async function uploadFileToDrive(
  drive: DriveClient,
  file: Buffer,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<{ fileId: string; url: string }> {
  const { Readable } = await import('stream')
  const stream = Readable.from(file)
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
  })
  return { fileId: res.data.id!, url: res.data.webViewLink! }
}

export async function deleteFileFromDrive(drive: DriveClient, fileId: string): Promise<void> {
  await drive.files.delete({ fileId })
}
