import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const COLORES_BG = ['#3F519E', '#FF7A66', '#3D9C6B', '#F4B860', '#8C6ED8']

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data ?? null
}

function calcularIniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  const primera = palabras[0]?.[0] ?? ''
  const ultima = palabras[palabras.length - 1]?.[0] ?? ''
  return (primera + ultima).toUpperCase()
}

async function revalidarLanding() {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return
  try {
    await fetch(`https://www.klia.com.ar/api/revalidate?secret=${secret}`, { method: 'POST' })
  } catch (err) {
    console.error('Error llamando a revalidate landing:', err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { quote, nombre, rol, avatar_url, orden, activo } = body

  const updateData: Record<string, unknown> = {}
  if (quote !== undefined) updateData.quote = quote
  if (rol !== undefined) updateData.rol = rol
  if (orden !== undefined) updateData.orden = orden
  if (activo !== undefined) updateData.activo = activo

  if (nombre !== undefined) updateData.nombre = nombre

  // avatar_url viene explícitamente en el body (string con URL, o null si se quitó la imagen)
  if (avatar_url !== undefined) {
    const tieneAvatar = !!avatar_url
    updateData.avatar_url = tieneAvatar ? avatar_url : null
    updateData.color_bg = tieneAvatar ? null : COLORES_BG[Math.floor(Math.random() * COLORES_BG.length)]
    updateData.iniciales = tieneAvatar ? null : calcularIniciales((nombre ?? '').trim())
  }

  updateData.updated_at = new Date().toISOString()

  const { error } = await serviceClient().from('testimonios').update(updateData).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await revalidarLanding()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceClient().from('testimonios').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await revalidarLanding()
  return NextResponse.json({ ok: true })
}
