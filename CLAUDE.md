# KLIA — App

## Project
SaaS platform for healthcare professionals in Argentina.
Repository: dibrand-dev/klia
Production: https://app.klia.com.ar
Landing: https://www.klia.com.ar (repo: dibrand-dev/klia-landing)
Super Admin panel: https://app.klia.com.ar/ops/login

## Stack
- Next.js 14 App Router + TypeScript
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Tailwind CSS + custom CSS design system (CSS variables)
- Vercel (CI/CD from main branch only — never push to preview branches)
- Mercado Pago OAuth (each professional connects their own MP account)
- Google Calendar + Google Drive API (OAuth per professional)
- Brevo API (transactional emails from hola@klia.com.ar)
- Gemini API (AI clinical summaries)
- Orchard AI (voice transcription — Whisper large-v3-turbo)
- pdflib (PDF generation for OS planillas)
- googleapis npm package (Google Drive file management)

## Key rules
- ALWAYS push to main branch — never to preview or feature branches
- Always show SQL before executing in Supabase
- Always run `npm run build` before committing
- Never use `window.confirm()` — use ConfirmDialog component
- Never use modals for complex interactions — always use SlideOver
- Never hardcode prices — read from Supabase `planes` table
- Always commit with descriptive message in format: `feat/fix/chore: description`
- Super Admin auth is separate: /ops/login → checks admin_users table
- Emails always sent via Brevo, never via Supabase default templates
- Pixel-perfect implementation of designs — never invent UI decisions
- CSS design system uses CSS variables (--ink, --surface, --border, etc.) not Tailwind for custom components

## CRITICAL — Supabase: new tables require explicit GRANTs (breaking change 2026-05-30)

Every new `CREATE TABLE` in the `public` schema MUST include:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nombre_tabla TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nombre_tabla TO service_role;
ALTER TABLE public.nombre_tabla ENABLE ROW LEVEL SECURITY;
```

Without these GRANTs the table is inaccessible via supabase-js and the app fails silently.
Always include them in the same migration file as the CREATE TABLE.

## CRITICAL — Mandatory testing after auth/middleware changes

Any change to middleware, auth routes, profiles, RLS policies, or handle_new_user trigger REQUIRES completing full registration+login test before pushing to main:

1. Register new user with test email
2. Verify confirmation email arrives
3. Confirm email → verify redirect to `/bienvenida`
4. Verify profile created correctly in `profiles` table
5. Login → verify dashboard loads
6. Delete test user when done

## Auth flow
- Professional login: www.klia.com.ar/login → app.klia.com.ar/auth/callback → /dashboard
- Super Admin login: app.klia.com.ar/ops/login → /ops/dashboard
- Google OAuth: /api/auth/google → /api/auth/google/callback
- Registration: /api/auth/registro → Brevo confirmation email → /auth/confirm (client-side hash handler) → /bienvenida

## Key files
- src/middleware.ts — route protection with PUBLIC_ROUTES list
- src/app/auth/callback/route.ts — server-side auth callback (PKCE)
- src/app/auth/confirm/page.tsx — client-side implicit flow handler
- src/lib/brevo.ts — email client (enviarEmail function)
- src/lib/email-templates.ts — 15+ email templates
- src/lib/mercadopago.ts — MP config
- src/lib/google-calendar.ts — Google Calendar helpers
- src/lib/google-drive.ts — Google Drive helpers (getOrCreateFolder, uploadFileToDrive)
- src/lib/sync-google-calendar.ts — sync functions
- src/lib/deuda.ts — debt calculation logic (calcularDeudaMes)
- src/lib/monedas.ts — multi-currency helpers
- src/lib/recurrentes.ts — recurring appointment logic
- src/lib/feriados.ts — national/provincial holidays (nolaborables.com.ar API)
- src/lib/especialidades.ts — 42 medical specialties list
- src/lib/planillas/ — PDF generators per OS (hospital-italiano.ts, ioma.ts, motor-generico.ts)
- src/hooks/useTerminologia.ts — configurable terminology (sesión/consulta)

## Key components
- src/components/pacientes/PacienteDetalle.tsx — patient profile with tabs (includes AsistenciaTab/Facturación)
- src/components/pacientes/PacienteHeader.tsx — patient profile header with action buttons
- src/components/pacientes/PlanillaOSSlide.tsx — planilla generation with sesiones declaradas
- src/components/pacientes/ArchivosTab.tsx — patient files via Google Drive
- src/components/pacientes/facturacion.css — pixel-perfect CSS for Facturación tab
- src/components/cobros/CobrosClient.tsx — cobros module (grouped by patient)
- src/components/cobros/DetallePacienteSlide.tsx — patient debt detail (all months, no filter)
- src/components/agenda/AgendaSemanal.tsx — weekly agenda view
- src/components/agenda/TurnoDetalleModal.tsx — appointment detail with 4 action buttons
- src/components/ajustes/AjustesClient.tsx — settings with terminologia, horarios, feriados sections
- src/components/ui/VoiceRecorder.tsx — voice recording with Orchard AI transcription

## Key pages
- src/app/(dashboard)/cobros/page.tsx — cobros server component (filters estado IN realizado,no_asistio AND fecha_hora <= now)
- src/app/(dashboard)/pacientes/[id]/page.tsx — patient profile page
- src/app/(dashboard)/facturacion/page.tsx — OS liquidation page
- src/app/ops/ — Super Admin panel

## API routes (key ones)
- POST /api/auth/registro — user registration
- GET /api/auth/google — Google OAuth initiation (scopes: calendar.events + drive.file)
- POST /api/cobros/registrar — register payment
- POST /api/cobros/pago-a-cuenta — global payment distribution (oldest to newest)
- POST /api/cobros/pago-parcial-mes — partial month payment
- DELETE /api/cobros/eliminar-cobro — delete individual payment record
- GET /api/feriados — national/provincial holidays
- POST /api/ajustes/aplicar-feriados — apply holiday bonification to sessions
- GET /api/archivos/listar — list patient Drive files
- POST /api/archivos/subir — upload file to Google Drive
- DELETE /api/archivos/eliminar — delete from Drive + DB
- GET /api/sesiones-declaradas — get declared sessions for planilla
- POST /api/sesiones-declaradas — save declared sessions
- POST /api/planillas/hospital-italiano — generate HI planilla PDF
- POST /api/planillas/ioma — generate IOMA planilla PDF
- POST /api/planillas/generar — generic OS planilla
- PATCH /api/turnos/estado — update session state inline
- POST /api/notas/transcribir — transcribe audio via Orchard AI
- GET /api/cron/recordatorios — daily reminders cron (runs 09:00 UTC)
- GET /api/cron/bloquear-trials — trial blocking cron (runs 06:00 UTC)

## Database — key tables
- profiles — professional profiles (terminologia, horarios_por_dia, feriados_nacionales, feriados_provinciales, firma_url, firma_sello_url)
  - `profiles.dni` (text, nullable) — DNI del profesional. Columna existente en producción con GRANTs completos a authenticated/service_role. NO correr ALTER TABLE para crearla. Se captura en el onboarding (step 2, obligatorio) y es editable en Ajustes. Usado para integración SISA/REFEPS (WS020).
- pacientes — patients (os_config_id FK → profesional_obras_sociales, firma_paciente_url, honorarios, moneda)
- turnos — appointments (estado: pendiente/confirmado/en_consultorio/realizado/no_asistio/cancelado; estado_pago: pendiente/pagado/pago_parcial/bonificado; recordatorio_enviado)
- notas_clinicas — clinical notes (rich text HTML)
- cobros — payment records (turno_id, monto_cobrado, medio_pago, fecha_cobro)
- profesional_obras_sociales — OS config per professional (nombre, planilla_template_id)
- planilla_templates — OS planilla templates (slug, config JSON)
- sesiones_declaradas — declared sessions for OS planillas (paciente_id, mes, anio, fecha, hora_entrada, hora_salida)
- archivos_paciente — patient files metadata (google_drive_file_id, google_drive_url, categoria)
- google_calendar_tokens — OAuth tokens per professional (access_token, refresh_token)
- suscripciones — MP subscriptions
- admin_users — Super Admin users
- configuracion_global — global config (voz_duracion_max_segundos)
- modulos_config — feature modules per plan
- plan_funcionalidades — features per plan
- planes — subscription plans
- colegios — convenios institucionales con colegios profesionales (nombre, contacto_nombre, contacto_email, fecha_acuerdo, activo)
- codigos_descuento — códigos de descuento por colegio (colegio_id FK, codigo, porcentaje_descuento, usos_maximos, usos_actuales, activo)
  - `profiles.codigo_descuento_id` (FK a codigos_descuento, nullable) y `profiles.codigo_aplicado_fecha` — se setean vía RPC `aplicar_codigo_descuento(p_profile_id, p_codigo)`, nunca directo. El RPC hace grandfathering: si el colegio corta el convenio (`codigos_descuento.activo = false`), los profesionales que ya tenían el código aplicado conservan el descuento — no se revalida `activo` en cada cobro, solo al momento de aplicar el código.

## Mercado Pago / Suscripciones — RLS (agregado 2026-07)

Todas las tablas de precios/descuentos tienen RLS habilitado. Patrón de policies que **hay que seguir siempre para nuevas tablas de este tipo**:

- **Bug recurrente ya cazado dos veces**: escribir `admin_users.id = auth.uid()` en el `qual` de una policy de admin. Esto está MAL — `admin_users.id` es la PK propia de esa tabla, no el UUID de Supabase Auth. El patrón correcto, usado en el resto del proyecto (`requireAdminUser()` en `src/lib/ops/auth.ts` matchea por email), es:
  ```sql
  EXISTS (SELECT 1 FROM admin_users a WHERE a.email = auth.email() AND a.activo = true)
  ```
  Si una tabla nueva de Ops tiene una policy de admin que compara `id = auth.uid()`, es casi seguro un bug — corregir a email antes de shipearla.
- **`planes`**: policy `authenticated_select_public_active_plans` (`USING (es_publico = true AND activo = true)`) — sin esto, `getPlanInfo`/`getMonto` devuelven precio `null` en silencio para cualquier profesional logueado (bug del "$0 en cuenta-bloqueada").
- **`codigos_descuento`**: policy `authenticated_select_own_codigo_descuento` — un profesional solo puede leer la fila del código que tiene asignado en su propio perfil (`id IN (SELECT codigo_descuento_id FROM profiles WHERE id = auth.uid())`), no el catálogo completo.
- **`colegios`**: policy `authenticated_select_own_colegio` — mismo patrón, solo el colegio del código que el profesional tiene aplicado.
- Ninguna de estas policies quedó como migración en `supabase/migrations/` — se corrieron directo en el SQL Editor de Supabase durante la sesión que las introdujo. Si se necesita reconstruir el schema desde cero, hay que volver a aplicarlas manualmente (no están en el repo).

## Suscripciones / Mercado Pago — flujo de cobro (agregado/corregido 2026-07)

- **Switch sandbox/producción resuelto** en `src/lib/mercadopago.ts`: `usarProduccion = process.env.MP_USE_PRODUCTION !== 'false'` (default producción si no está seteada — nunca cae en sandbox por accidente). Exporta `mpClient`, `mpAccessToken` y `mpPublicKey` ya resueltos; todo el resto del código (backend y frontend) importa estos valores en vez de leer `MP_ACCESS_TOKEN_PROD`/`TEST` directo. El Payment Brick (`src/components/suscripcion/CheckoutBrick.tsx`) recibe `mpPublicKey` como prop desde un server component (`checkout/page.tsx`, `planes/page.tsx`) — no hay `NEXT_PUBLIC_*` involucrada, así que no hay riesgo de valor congelado en build time (ambas rutas son `ƒ` dinámicas, confirmado en build output).
- **`src/app/api/suscripcion/procesar/route.ts`** — creación de suscripción con **una sola llamada** a `PreApproval.create({ status: 'authorized', card_token_id })`. Antes hacía `Payment.create()` + `PreApproval.create()` reusando el mismo token de tarjeta para las dos llamadas (los tokens de MP son de un solo uso) — la segunda llamada fallaba silenciosamente dentro de un `try/catch` vacío, dejando `mp_preapproval_id: null` en `suscripciones` pese a que el cobro sí se había hecho. Ahora: si `PreApproval.create()` falla o `sub.status !== 'authorized'`, se loggea con `console.error` y se devuelve 422 — nunca se inserta una fila con estado inconsistente.
- **`src/app/api/suscripcion/webhook/route.ts`** — solo maneja `type === 'subscription_preapproval'`; cualquier otro `type` (ej. `payment`) se loggea (`console.log`) antes de descartarse, en vez de un `return` mudo — para que si aparece un patrón de notificaciones no manejadas, quede rastro.
- **`src/app/api/suscripcion/cancelar/route.ts`** — si `preApproval.update()` (cancelación real en MP) falla, ya NO se marca `estado: 'cancelled'` en la base ni se muestra éxito al usuario — devuelve 502 con mensaje claro, loggeando el error completo. Si `mp_preapproval_id` es `null` (fila inconsistente), devuelve 422 explicando que no hay suscripción de MP asociada, en vez de "cancelar" en silencio sin tocar nada del lado real de Mercado Pago.
- **Fuente única para el ID de suscripción de MP: `suscripciones.mp_preapproval_id`** (ya no `profiles.mp_subscription_id`, que se escribía en 2 lugares y nunca se leía en ningún otro — eliminado). **Ojo con la trampa**: `profiles` tiene su propia columna `mp_preapproval_id` (confirmado que existe en el schema real), pero es de una feature totalmente distinta y no relacionada — el cluster `mp_access_token`/`mp_refresh_token`/`mp_token_expiry`/`mp_email`/`mp_nombre`/`mp_public_key`/`mp_user_id`/`mp_preapproval_id` en `profiles` pertenece al OAuth de "cada profesional conecta su propia cuenta de MP" (para cobrar a sus pacientes), no a la suscripción de KLIA. Nada en el código escribe nunca esa columna de `profiles` — si algo la lee esperando el dato de la suscripción de KLIA, va a estar siempre `null` (bug ya cazado y corregido en `cuenta-bloqueada/page.tsx`, que leía mal esa columna).
- **`src/app/cuenta-bloqueada/page.tsx`** — gate de acceso: acepta `estado_cuenta === 'bloqueada'` (trial vencido / pago fallido) **y** `'cancelada'` (antes solo `'bloqueada'`, lo que generaba un loop infinito de redirects entre este archivo y `(dashboard)/layout.tsx` para cuentas canceladas — los dos archivos decidían de forma contradictoria si `'cancelada'` era válida acá). Muestra 3 mensajes distintos según `motivoBloqueo` (`trial_vencido` / `pago_fallido` / `cancelada`) — el de cancelada NO tiene tono de "período de prueba" (ya fue cliente pagando), ofrece reactivar eligiendo un plan.
- Endpoint temporal `/api/ops/diagnostico-precio` (usado para validar cálculo de descuento institucional en producción) ya cumplió su función y fue eliminado.

## Plans and access control
- Esencial: agenda, pacientes, historial, calendar sync
- Profesional: + cobros, facturación, IA atenciones, nota_voz
- Premium: + archivos_paciente, link público reservas, informes IA
- Bonificado: all modules
- puedeAcceder(modulo, plan, modulos) — access check helper

## Configurable terminology
- profiles.terminologia: 'sesion' | 'consulta'
- Auto-assigned on registration based on especialidad
- Medical specialties → 'consulta'; therapeutic → 'sesion'
- getTerminologia() hook in src/hooks/useTerminologia.ts

## Módulo de nutrición (antropometría) — agregado 2026-07

Feature visible solo para profesionales con `profiles.especialidad === 'Nutrición'` (string exacto de `src/lib/especialidades.ts` — **nunca** `'Nutricionista'`, ese valor no existe en el sistema y fue la causa de un bug donde toda la feature quedaba invisible).

- **`src/lib/nutricion/calculos.ts`** — funciones puras sin dependencias de React/Supabase:
  - `calcularIMC(peso, altura)` — normaliza altura a metros automáticamente (si `altura > 3` asume que vino en cm).
  - `clasificarIMC(imc)` — devuelve `{ label, status }` con status `'info' | 'success' | 'warning' | 'danger'` (Bajo peso / Normal / Sobrepeso / Obesidad).
  - `calcularGEB(peso, altura, edad, sexo, formula)` — soporta `'mifflin'` (Mifflin-St Jeor) y `'harris'` (Harris-Benedict 1984).

- **`src/components/nutricion/StickyWidgetAntropometria.tsx`** — widget client-side con 3 cards: IMC (badge de color según clasificación), GEB (toggle Mifflin/Harris-Benedict), y variación de peso vs. el último `registros_antropometricos` guardado (excluye el registro en edición vía `registroEnEdicionId`).

- **SlideOver "Nueva nota clínica" (`src/components/pacientes/NuevaNotaForm.tsx`)** — si `esNutricionista`, muestra una sección de antropometría (peso, altura, cintura, cadera, %grasa, %músculo + sección colapsable de pliegues cutáneos/perímetros) antes de la nota de sesión. Al guardar, si hay algún dato cargado, inserta también en `registros_antropometricos`.
  - Layout: el SlideOver usa `width="lg"` (672px, seteado en `AppShell.tsx`) porque con el ancho default (`md`, 512px) el widget sticky lateral dejaba los inputs con ~200px para 3 columnas — quedaban inusables.
  - El grid de inputs usa `gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'` (no columnas fijas) para adaptarse al espacio disponible.
  - El layout de dos columnas (inputs + widget sticky) solo se activa en `lg:` (1024px+); por debajo se usa una barra colapsable mobile (`StickyWidgetAntropometriaBarraMobile`) a todo el ancho. Con breakpoint `md:` (768px) el widget lateral apretaba los inputs en pantallas medianas/tablet.
  - Inputs numéricos (`AntropoInput`) ocultan el spinner nativo del navegador vía `<style jsx>` con `::-webkit-outer/inner-spin-button` y `-moz-appearance: textfield` — sin esto las flechas nativas hacían el campo muy angosto para escribir.

- **Tab "Antropometría" en ficha de paciente** (`src/components/pacientes/PacienteTabs.tsx`, `PacienteDetalle.tsx`) — visible con la misma condición `especialidad === 'Nutrición'`. Se llamó "Composición Corporal y Nutrición" originalmente, renombrada a "Antropometría" (más corto, término técnico correcto, los profesionales de la app son quienes la ven — no los pacientes). Renderiza `src/components/nutricion/TabComposicionCorporal.tsx` (gráfico Recharts de evolución de %grasa/%músculo + tabla histórica paginada) y `RegistroAntropometricoEditSlide.tsx` (edición de un registro puntual al clickear una fila).
  - Los widgets de "Menú Semanal" y "Distribución de Macronutrientes" ya NO son placeholders — tienen datos reales y abren SlideOvers propios: `SlideOverMenuSemanal.tsx` (grid 7 días x 4 comidas, guardado por celda al blur, botón "Duplicar semana anterior", acordeón mobile bajo 720px) y `SlideOverMacros.tsx` (input de kcal objetivo, 3 sliders custom acoplados que redistribuyen proporcionalmente vía `redistribuirMacros()` en `src/lib/nutricion/calculos.ts`, barra de macros con gramaje). Ambos con guardado automático (upsert), sin botón "Guardar" explícito.
  - `SlideOver.tsx` (componente reutilizable) tiene una variante `xl` (760px) agregada para el de menú semanal — las variantes previas (`sm`/`md`/`lg`, hasta 672px) no alcanzaban para el grid de 7 columnas.

- **Tabla `registros_antropometricos`** — columnas: `id, terapeuta_id, paciente_id, turno_id (nullable), fecha, peso, altura, cintura, cadera, pliegue_tricipital, pliegue_subescapular, pliegue_suprailiaco, perimetro_brazo, perimetro_pierna, porcentaje_grasa, porcentaje_musculo, notas, created_at, updated_at`.

- **Tabla `menu_semanal`** — columnas: `id, terapeuta_id, paciente_id, semana_inicio (date, lunes de la semana), dia (text: 'Lunes'..'Domingo'), comida (text: 'Desayuno'/'Almuerzo'/'Merienda'/'Cena'), descripcion, created_at, updated_at`. Constraint único: `(paciente_id, semana_inicio, dia, comida)`.

- **Tabla `distribucion_macros`** — columnas: `paciente_id (PK), terapeuta_id, porcentaje_carbohidratos (default 45), porcentaje_proteinas (default 30), porcentaje_grasas (default 25), kcal_objetivo (nullable), updated_at`. Un solo registro por paciente (no histórico).

- **Solapa "Documentos" eliminada** de la ficha de paciente (era un placeholder "Próximamente" sin componente propio, nunca se implementó — duplicaba a "Archivos", que sí funciona con Google Drive).

## CRITICAL — Next.js Client Router Cache: `force-dynamic` NO alcanza para mutación + navegación (agregado 2026-07)

Bug de fondo cazado dos veces (tabs de paciente vía `?tab=`, y alta de paciente redirigiendo a `/pacientes`): `export const dynamic = 'force-dynamic'` en una page.tsx solo desactiva el **Data Cache del servidor** — Next.js 14 sigue sirviendo desde el **Client-side Router Cache** del navegador (`staleTimes.dynamic`, default 30s) al navegar con `<Link>` o `router.push()`, aunque la página de destino sea `force-dynamic`. Síntoma: la URL cambia pero el contenido y los estados visuales (ej. clase de tab activo) no se actualizan, como si el click no hubiera hecho nada.

**Patrón correcto:**
- Navegación por `<Link href="?param=X">` repetida sobre la misma ruta (ej. tabs): agregar `onClick={() => router.refresh()}` al Link, preservando el `href` normal — no reemplazar por botón.
- Mutación (POST/insert) seguida de `router.push(destino)`: el orden importa. `router.refresh()` invalida el cache de la ruta **actual**, no la de destino — hay que hacer `router.push(destino)` primero y `router.refresh()` inmediatamente después, nunca al revés.
- No usar `staleTimes: { dynamic: 0 }` en `next.config.js` como fix global salvo que se evalúe explícitamente el impacto en toda la app (más fetches a Supabase en cada navegación) — se prefirió el fix quirúrgico por componente.
- Antes de asumir que un "no se ve reflejado tras guardar" es este bug: confirmar contra el síntoma real. Si el registro nunca aparece ni esperando ni con hard refresh/incógnito, probablemente NO es cache — puede ser un problema real de query (paginación, orden, filtro, RLS). Ya pasó una vez: se asumió cache sin verificar y la causa real era paginación alfabética + un buscador que solo filtraba el array de la página cargada en vez de consultar Supabase (ver fix en `ListaPacientes.tsx` — búsqueda con debounce 300ms + `ilike` contra la base).

## Holidays
- API: nolaborables.com.ar/api/v2/feriados/{año}
- profiles.feriados_nacionales, profiles.feriados_provinciales (boolean toggles)
- profiles.feriados_trabajar_si_confirmado — override for confirmed sessions
- Cached 24h in memory

## Google Drive structure
KLIA/Pacientes/[Apellido Nombre]/[Categoria]/
Categories: Laboratorio, Imágenes, Documentos, Otros

## Cron jobs (vercel.json)
- `0 6 * * *` → /api/cron/bloquear-trials
- `0 7 * * *` → /api/pagos/vencer
- `0 9 * * *` → /api/cron/recordatorios (sends reminders for tomorrow's sessions)
- Auth: accepts `x-vercel-cron: 1` header OR `Authorization: Bearer CRON_SECRET`

## Environment variables (all set in Vercel)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
BREVO_API_KEY,
MP_PUBLIC_KEY_TEST, MP_ACCESS_TOKEN_TEST, MP_PUBLIC_KEY_PROD, MP_ACCESS_TOKEN_PROD,
MP_CLIENT_ID, MP_CLIENT_SECRET, MP_WEBHOOK_SECRET, MP_USE_PRODUCTION,
NEXT_PUBLIC_APP_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
GEMINI_API_KEY, ORCHARD_API_KEY, CRON_SECRET

## Design system
Custom CSS variables defined in component-level CSS files:
- Colors: --bg, --surface, --surface-2, --surface-3, --border, --border-strong, --ink, --ink-2, --muted, --muted-2, --muted-3
- Semantic: --accent, --ok, --ok-soft, --warn, --warn-soft, --danger, --danger-soft, --green, --green-soft, --green-ink, --amber, --amber-soft, --amber-ink, --red-2, --red-soft, --blue, --blue-soft
- Radii: --r-sm (6px), --r-md (8px), --r-lg (12px), --r-xl (16px)
- Shadows: --shadow-sm, --shadow-md, --shadow-lg
- Fonts: Inter (body), JetBrains Mono (numbers/monospace)

## Supabase project
- Project ID: bdokvwturcbebsjxtbpi
- RLS enabled on all tables
- Storage buckets: firmas-profesionales, firmas-pacientes, obras-sociales (logos), archivos-pacientes

## Cumplimiento Normativo

### Bus de Interoperabilidad — Red Nacional de Salud Digital (T&C vigentes)

Todo endpoint que consuma servicios del Bus de Interoperabilidad (REFEPS, RENAPER, PUCO, etc.) debe cumplir:

- **Logging obligatorio**: registrar cada llamada al Bus en una tabla de auditoría en Supabase (`bus_audit_logs` o similar) con: fecha/hora, usuario autenticado, servicio consultado, IP de origen, y resultado. Conservar por 5 años (Disposición 1/2025, Anexo I).
- **Rate limiting**: implementar límite de llamadas por usuario/IP en todos los endpoints que consulten el Bus, para detección de comportamiento anómalo.
- **Notificación de incidentes**: ante cualquier brecha de seguridad o acceso no autorizado a datos del Bus, notificar al Ministerio de Salud (soporte@sisa.msal.gov.ar) y a la AAIP (Resolución AAIP N° 47/2018) sin dilación.
- **Credenciales**: las credenciales del Bus (Código de dominio, Nombre de aplicación, Password) se almacenan exclusivamente en Vercel Environment Variables. Nunca en código, nunca en logs, nunca en respuestas al cliente.
- **Uso exclusivo**: las credenciales del Bus son para uso exclusivo de KLIA. No compartir ni delegar a terceros.

### Ley 25.326 — Protección de Datos Personales

Todo módulo que trate datos personales de pacientes o profesionales debe:

- **Consentimiento**: no recolectar datos sin consentimiento explícito del titular.
- **Finalidad**: usar los datos exclusivamente para el fin declarado al momento de la recolección. Los datos del Bus (matrículas, identidad profesional) solo pueden usarse para validación interna en KLIA, no para otros fines.
- **Acceso y rectificación**: el profesional puede ver y corregir sus propios datos en Ajustes en todo momento.
- **Confidencialidad**: los datos personales no se exponen en logs del servidor, respuestas de error al cliente, ni en ningún output visible fuera del contexto autenticado del usuario titular.
- **Seguridad**: RLS habilitado en todas las tablas de Supabase que contengan datos personales. Ninguna tabla con datos sensibles accesible sin autenticación.

## Ultimos cambios
_Actualizado el 2026-07-23_

```
a0b0ba1 chore: commit vacio para verificar disparo de webhook de deploy en Vercel
deb0db9 chore: eliminar campo mp_subscription_id sin uso, corregir lectura de mp_preapproval_id en cuenta-bloqueada
e112887 chore: eliminar endpoint temporal de diagnóstico de precios, ya cumplió su función
18bcd94 fix: eliminar loop de redirects para cuentas canceladas, mostrar mensaje diferenciado de reactivacion
e9ca176 fix: no marcar suscripcion como cancelada si la llamada a preApproval.update falla, evita estado desincronizado con MP
b410893 fix: unificar creacion de suscripcion en una sola llamada a PreApproval con status authorized, elimina reuso de token
a68aad5 feat: reemplazar link Editar por iconos y agregar eliminacion de codigos de descuento con proteccion de uso
a880b68 docs: actualiza CLAUDE.md con modulo de nutricion completo, fix de router cache, y ultimos cambios
b488d92 fix: cambia horario de cron del doc de Google Drive para evitar congestion de GitHub Actions a la hora en punto
7823025 fix: corrige efecto de rebote visual del icono de carga en buscador de pacientes
7a08b11 fix: busqueda de pacientes ahora consulta supabase en vez de filtrar solo la pagina actual
27ba53c fix: evita lista de pacientes stale tras alta (force-dynamic + orden correcto push/refresh)
97bfb4e fix: agrega router.refresh() a navegacion por tabs via query param para evitar router cache stale de nextjs
6743c01 chore: renombra solapa a Antropometria (mas corto y termino tecnico correcto)
c8ec029 fix: elimina solapa Documentos de ficha de paciente (placeholder sin funcionalidad, duplicaba Archivos)
8c897d8 feat: agrega slideovers de menu semanal y distribucion de macros
01d971e feat: agrega variante xl (760px) a SlideOver reutilizable
06d1ee6 docs: documentar modulo de nutricion/antropometria en CLAUDE.md
bf09b4c fix: mejorar layout del SlideOver de antropometria (ancho lg, grid flexible, breakpoint lg)
5435420 chore: corrige indentacion de AntropometriaSection tras edicion manual
```
