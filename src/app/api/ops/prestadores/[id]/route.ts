import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    plan, estado_cuenta, trial_fin,
    nombre, apellido, especialidad, matricula,
    telefono, pais, provincia, localidad, direccion,
    cuit, condicion_iva, razon_social,
  } = body

  const db = serviceClient()

  // Fase 3 matrículas (Ajustes v3): profiles.matricula ya no se escribe
  // directo desde este endpoint — lo sincroniza trg_sync_matricula_principal
  // a partir de profesional_matriculas (migración 024). Se valida ANTES de
  // tocar profiles, para que el PATCH sea atómico: si la matrícula queda
  // bloqueada, no se guarda ningún otro campo tampoco.
  if (matricula !== undefined) {
    if (typeof matricula !== 'string' || !matricula.trim()) {
      // A pedido explícito: nunca se borra la matrícula principal desde
      // acá — un valor vacío se rechaza en vez de limpiar la fila.
      return NextResponse.json({ error: 'La matrícula no puede quedar vacía.' }, { status: 400 })
    }

    const { data: principal } = await db
      .from('profesional_matriculas')
      .select('id, origen')
      .eq('profesional_id', params.id)
      .eq('es_principal', true)
      .maybeSingle()

    if (principal?.origen === 'refeps') {
      return NextResponse.json({ error: 'Matrícula verificada por REFEPS, no editable desde OPS' }, { status: 409 })
    }

    const numero = matricula.trim()
    if (principal) {
      const { error: errMat } = await db.from('profesional_matriculas').update({ numero }).eq('id', principal.id)
      if (errMat) return NextResponse.json({ error: errMat.message }, { status: 500 })
    } else {
      // Sin ninguna fila todavía — se inserta manual, no verificada; el
      // trigger la marca principal por ser la primera.
      const { error: errMat } = await db.from('profesional_matriculas').insert({
        profesional_id: params.id,
        numero,
        origen: 'manual',
        verificada: false,
      })
      if (errMat) return NextResponse.json({ error: errMat.message }, { status: 500 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (apellido !== undefined) updateData.apellido = apellido
  if (especialidad !== undefined) updateData.especialidad = especialidad
  if (telefono !== undefined) updateData.telefono = telefono
  if (pais !== undefined) updateData.pais = pais
  if (provincia !== undefined) updateData.provincia = provincia
  if (localidad !== undefined) updateData.localidad = localidad
  if (direccion !== undefined) updateData.direccion = direccion
  if (cuit !== undefined) updateData.cuit = cuit
  if (condicion_iva !== undefined) updateData.condicion_iva = condicion_iva
  if (razon_social !== undefined) updateData.razon_social = razon_social
  if (plan !== undefined) updateData.plan = plan
  if (estado_cuenta !== undefined) updateData.estado_cuenta = estado_cuenta
  if (trial_fin !== undefined) updateData.trial_fin = trial_fin

  const { error } = await db
    .from('profiles')
    .update(updateData)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceClient().auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

