import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await request.formData()
  const audio = formData.get('audio') as Blob | null

  if (!audio) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
  }

  const orchardForm = new FormData()
  orchardForm.append('file', audio, 'nota.webm')
  orchardForm.append('language', 'es')
  orchardForm.append('response_format', 'json')

  const response = await fetch('https://api.orchardrun.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ORCHARD_API_KEY}`,
    },
    body: orchardForm,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('[transcribir] Orchard error:', response.status, text)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }

  const data = await response.json() as { text?: string }
  return NextResponse.json({ text: data.text ?? '' })
}
