import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente service_role — bypassea RLS. Usar solo server-side, y solo después
// de validar ownership a mano (ver getEffectiveTerapeutaIdServer).
//
// fetch con cache:'no-store' explícito: supabase-js hace fetch() por debajo,
// y Next.js cachea esas requests en su Data Cache aunque la route handler o
// server component que las dispara tenga dynamic='force-dynamic' — ese flag
// solo afecta el render de la ruta, no las fetch() individuales que hace
// dentro (mismo gotcha ya cazado en /api/booking/disponibilidad). Para un
// cliente que valida permisos y ownership en cada request, servir una
// respuesta vieja cacheada es un bug de seguridad, no una optimización
// válida — ej. un plan_compartidos.revocado_en desactualizado seguía
// dejando pasar un link público ya revocado.
export function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}
