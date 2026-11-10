import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Mismo chequeo que el POST de alta — edición/suspensión de vendedor es
// exclusiva de Super Admin ('total').
async function getAdminUserTotal() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id, rol')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data?.rol === 'total' ? data : null
}

interface Body {
  nombre?: unknown
  apellido?: unknown
  comision_pct?: unknown
  meses_comision?: unknown
  dias_colchon?: unknown
  activo?: unknown
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUserTotal()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Body

  const updates: Database['public']['Tables']['vendedores']['Update'] = {}

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
      return NextResponse.json({ error: 'nombre inválido' }, { status: 400 })
    }
    updates.nombre = body.nombre.trim()
  }

  if (body.apellido !== undefined) {
    if (typeof body.apellido !== 'string' || !body.apellido.trim()) {
      return NextResponse.json({ error: 'apellido inválido' }, { status: 400 })
    }
    updates.apellido = body.apellido.trim()
  }

  if (body.comision_pct !== undefined) {
    if (typeof body.comision_pct !== 'number' || !Number.isFinite(body.comision_pct) || body.comision_pct < 0 || body.comision_pct > 100) {
      return NextResponse.json({ error: 'comision_pct debe ser un número entre 0 y 100' }, { status: 400 })
    }
    updates.comision_pct = body.comision_pct
  }

  if (body.meses_comision !== undefined) {
    if (typeof body.meses_comision !== 'number' || !Number.isInteger(body.meses_comision) || body.meses_comision < 1 || body.meses_comision > 60) {
      return NextResponse.json({ error: 'meses_comision debe ser un entero entre 1 y 60' }, { status: 400 })
    }
    updates.meses_comision = body.meses_comision
  }

  if (body.dias_colchon !== undefined) {
    if (typeof body.dias_colchon !== 'number' || !Number.isInteger(body.dias_colchon) || body.dias_colchon < 0 || body.dias_colchon > 365) {
      return NextResponse.json({ error: 'dias_colchon debe ser un entero entre 0 y 365' }, { status: 400 })
    }
    updates.dias_colchon = body.dias_colchon
  }

  if (body.activo !== undefined) {
    if (typeof body.activo !== 'boolean') {
      return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 })
    }
    updates.activo = body.activo
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const db = serviceClient()

  // Se necesita el estado actual para poder revertir `activo` si falla el
  // ban/unban en Auth, y el user_id para ese mismo llamado — nunca se lee
  // con el cliente de sesión porque `vendedores` tiene RLS sin policies.
  const { data: actual, error: actualError } = await db
    .from('vendedores')
    .select('user_id, activo')
    .eq('id', params.id)
    .single()

  if (actualError || !actual) {
    console.error('[ops/vendedores/patch] Vendedor no encontrado:', params.id, actualError)
    return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 })
  }

  const cambiaActivo = updates.activo !== undefined && updates.activo !== actual.activo

  const { error: updateError } = await db.from('vendedores').update(updates).eq('id', params.id)

  if (updateError) {
    console.error('[ops/vendedores/patch] Error actualizando vendedor:', params.id, updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (cambiaActivo) {
    const { error: banError } = await db.auth.admin.updateUserById(actual.user_id, {
      ban_duration: updates.activo ? 'none' : '876000h',
    })

    if (banError) {
      console.error('[ops/vendedores/patch] Error actualizando el ban de Auth, revirtiendo activo:', params.id, banError)
      const { error: revertError } = await db.from('vendedores').update({ activo: actual.activo }).eq('id', params.id)
      if (revertError) {
        console.error('[ops/vendedores/patch] Error revirtiendo activo tras fallo de Auth:', params.id, revertError)
      }
      return NextResponse.json({ error: 'No se pudo actualizar el acceso del vendedor. Intentá de nuevo.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
