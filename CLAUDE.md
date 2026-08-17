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
- Vercel (CI/CD from main branch for production; `staging` branch + klia-staging Supabase project for high-risk changes — ver "Flujo de deploy")
- Mercado Pago OAuth (each professional connects their own MP account)
- Google Calendar + Google Drive API (OAuth per professional)
- Brevo API (transactional emails from hola@klia.com.ar)
- Gemini API (AI clinical summaries)
- Orchard AI (voice transcription — Whisper large-v3-turbo)
- pdflib (PDF generation for OS planillas)
- googleapis npm package (Google Drive file management)

## Key rules
- Ver "Flujo de deploy" más abajo — ya no es siempre push directo a main, depende del tipo de cambio
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

## Flujo de deploy

KLIA tiene dos ambientes: producción (main, Vercel + Supabase Klin) y staging (rama `staging`, Vercel + Supabase klia-staging).

**Va directo a main:** cambios de UI, copy, estilos, fixes aislados que no tocan autenticación, middleware, RLS, ni la resolución de terapeuta_id/colaboradores.

**Pasa por staging primero:** cualquier cambio que toque auth, middleware.ts, handle_new_user, políticas RLS, o call sites que dependan de terapeuta_id (incluye toda la Fase B del rol Colaboradora). Flujo: commit y push a `staging` → verificar en la URL de staging con la cuenta norberto@dibrand.co → si está bien, merge de staging a main → verificar de nuevo en producción.

`git push origin HEAD:main` para producción, `git push origin HEAD:staging` para staging — nunca confundir destino.

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

## OPS — Tabla de Prestadores (rediseñada 2026-07)

`src/components/ops/PrestadoresTable.tsx` + `src/app/ops/(protected)/prestadores/page.tsx`:

- **Columna "Colegio" reemplazada por "Código"**: antes traía nombre completo del colegio (3 queries encadenadas `profiles`→`codigos_descuento`→`colegios`); ahora solo el código (`COLE215`) con el `%` de descuento en un tooltip CSS puro (`group-hover`, sin JS) — elimina la query a `colegios` por completo.
- **Sin scroll horizontal**: contenedor a `max-w-[1400px]` (antes 1200px), padding de celdas `px-3` (antes `px-6`), columna Profesional con nombre y email truncados a 30 caracteres (`TruncatedCell`, `title=` con el texto completo) — ancho de tabla ahora es prácticamente fijo, no depende del largo real de los datos.
- **Ordenamiento por header**: click en Profesional/Especialidad/Plan/Estado/Registro/Último acceso ordena, un segundo click invierte. Estado en la URL (`?sort=&dir=`) vía `router.replace`, sorteo client-side (no hay paginación todavía). Dirección default por tipo de columna: texto → A→Z, fechas → más reciente primero, Plan/Estado → por rank de urgencia/jerarquía (`PLAN_RANK`/`ESTADO_RANK` en el componente), no alfabético — alfabético en esas dos no tiene ningún significado operativo.
- **Nota**: los `<select>` de filtro por Plan/Estado en el formulario de búsqueda son decorativos — el RPC `admin_get_profiles` solo acepta `p_search`, nunca se llegó a implementar el filtrado real por esos dos campos. Pendiente, no tocado en este cambio.

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

## Catálogo CIE-10 completo (campo Código Diagnóstico) — agregado 2026-07

Campo `codigo_diagnostico` (Alta de Paciente y Ficha del paciente) usa un `<datalist>` alimentado por el catálogo CIE-10 completo (8.899 códigos, nivel 4 dígitos/asignable, formato `F41.0`, fuente `github.com/verasativa/CIE-10`), **no** por `CIE10_FRECUENTES` (lista curada de ~50 entradas usada aparte).

- **`public/data/cie10.json`** — asset estático (~825KB), servido directo por Vercel, nunca importado en un componente ni bundleado en el JS de la app.
- **`src/lib/hooks/useCie10.ts`** — hook `useCie10()` con carga perezosa: el fetch a `/data/cie10.json` se dispara recién en el primer `onFocus` del input (no en el mount del componente), y se cachea a nivel de módulo (`let cie10Cache`/`cie10Promise`, no `useState`) para que una segunda pantalla en la misma sesión (ej. pasar de Alta a Ficha) no vuelva a pedir el archivo. Si el fetch falla, el `.catch()` resetea `cie10Promise = null` para permitir reintento en el próximo `onFocus` — el campo sigue funcionando como texto libre sin romper la UI ni dejar un unhandled rejection.
- Wiring en `NuevoPacienteForm.tsx` (`datalist id="npf-cie10"`) y `PacienteDetalle.tsx` (`id="pd-cie10"`), mismo patrón que `nacionalidad`/`plan_obra_social` (`list=` + `autoComplete="off"`). El `<option value={codigo}>` inserta solo el código en el input (no código + descripción), preservando el formato que ya tenía el campo antes (usado tal cual en Ficha y en los PDFs de planillas).
- **`NuevoInformeSlide.tsx`** (Informes IA) es una feature aparte, no tocada — sigue con `CIE10_FRECUENTES` inline y su propia UI de búsqueda custom, no consume el catálogo completo.

## Visor lightbox de imágenes en Archivos del Paciente (agregado 2026-07)

`ArchivosTab.tsx` — el click en el nombre de un archivo con `mime_type` que empieza con `image/` abre `ImagenLightbox.tsx` (overlay fullscreen, zoom por click fit-to-screen/100%, cierre con Escape/click-fuera/X) en vez de abrir Google Drive en pestaña nueva. PDF/Word/Excel mantienen el flujo de siempre.

- **`GET /api/archivos/[id]/contenido`** — proxy de streaming desde Drive (`drive.files.get({ alt: 'media' }, { responseType: 'stream' })`), verifica que el archivo pertenezca a un paciente del `terapeuta_id` autenticado, devuelve 400 si `mime_type` no es de imagen. Nunca expone `google_drive_url` directo para este flujo — todo pasa por este endpoint autenticado.

## Módulo de Oftalmología: Refracción y PIO corregida (agregado 2026-07)

Dos features nuevas, ambas condicionadas a `especialidad === 'Oftalmología'` (mismo patrón que Nutrición/`'Nutrición'`).

### Refracción (`RxGrid.tsx`)
- Tab "Refracción" en ficha de paciente (`PacienteTabs.tsx`/`PacienteDetalle.tsx`, variant `standalone`) + sección embebida colapsable en el SlideOver de nota clínica (`NuevaNotaForm.tsx`, variant `embebida`).
- **Edición inline por celda** (pixel-perfect según diseño real, no una interpretación): click en una celda de OD/OI activa un `<input>` ahí mismo, blur/Enter confirma, Escape cancela. Historial como dropdown (`.rx-hist-menu`) con chip Completa/Incompleta vía `recetaCompleta()`. Celdas vacías muestran `—` en `var(--muted-3)`. 5 columnas: SPH/CYL/AXIS/ADD/AV.
- **Solo la receta más reciente es editable** (`recetas[0]`); las anteriores son de solo lectura con aviso "Registro histórico — no editable".
- **Persistencia — regla insert-only con corrección posterior**: cada edición de campo hace `PATCH /api/refraccion/actualizar` (UPDATE in-place, filtrado por `id` + `terapeuta_id`) si la receta top ya tiene `id`, o `POST /api/refraccion/crear` (INSERT) si es un draft recién creado con el botón "Nueva receta" (`id: null`, aún no persistido). **Ojo con la trampa ya cazada una vez**: la primera implementación hacía INSERT en cada blur de celda, generando una fila nueva por campo editado en vez de ir completando la misma receta — el fix separó ambos casos explícitamente en `commitField()` de `RxGrid.tsx`.
- `src/lib/oftalmologia/refraccion.ts` — `recetaCompleta()`, `formatearDioptrias()` (antepone `+` si es positivo).
- Tabla `registros_refraccion`: `id, paciente_id, terapeuta_id, turno_id (nullable), sph_od, cyl_od, axis_od, add_od, av_od, sph_oi, cyl_oi, axis_oi, add_oi, av_oi, created_at`.

### PIO corregida (`StickyWidgetPIO.tsx`)
- Sección en `NuevaNotaForm.tsx` (mismo patrón que Antropometría: `AntropoGrid`/`AntropoInput` reusados, widget sticky en desktop, barra colapsable mobile `StickyWidgetPIOBarraMobile`), 4 inputs: PIO OD/OI (mmHg), Paquimetría OD/OI (µm).
- `src/lib/oftalmologia/calculos.ts` — `calcularPIOCorregida(pioMedida, paquimetria)` (fórmula de Ehlers: `pioMedida - ((paquimetria - 545) / 25) * 2.5`), `clasificarPIO(pio)` reusa el type `IMCStatus` de `src/lib/nutricion/calculos.ts` (`< 10` Baja/info, `10-21` Normal/success, `> 21` Elevada/warning).
- Al guardar la nota, si hay al menos un valor de PIO cargado, insert en `registros_pio` (mismo patrón que `registros_antropometricos`: si falla, la nota se guarda igual y se avisa el error puntual del PIO).
- Tabla `registros_pio`: `id, paciente_id, terapeuta_id, turno_id (nullable), fecha, pio_medida_od, paquimetria_od, pio_medida_oi, paquimetria_oi, created_at`.

## Flujo de sala de espera — `turnos.estado_atencion` (agregado 2026-07)

- **Bug de fondo cazado y corregido**: `AtencionesClient.tsx` leía `turno.estado` (pendiente/confirmado/realizado/no_asistio/cancelado) para el badge "En Consultorio", que en realidad vive en la columna separada `turno.estado_atencion` (`en_preparacion`/`en_espera`/`en_consultorio`/`atendido`/`ausente`). El badge ahora usa `estado_atencion` cuando no es `null`, y recién cae a `estado` cuando el turno todavía no arrancó su día operativo.
- **`PATCH /api/turnos/estado-atencion`** — mismo patrón de auth/verificación que `/api/turnos/estado` (ya existente, actualiza la columna `estado`), pero sobre `estado_atencion`.
- Botones de acción por fila en Atenciones: "En espera" → "A consultorio" → "Atendido", visibles condicionalmente según el estado actual. `en_preparacion` no tiene botón dedicado todavía (queda disponible en el backend, sin trigger definido en la UI — probablemente un flag específico de Oftalmología a resolver más adelante).
- `AtencionesClient.tsx` mantiene `turnos` en state local (`useState` inicializado desde el prop) para reflejar cambios de `estado_atencion` sin recargar la página. Stats y filtros "Pendientes"/"Atendidos" corregidos para leer `estado_atencion` en vez de `estado` donde corresponde.

## Meta Pixel — CompleteRegistration en flujo de registro (agregado 2026-07)

- **Pixel base** (ID `1330774269119331`) cargado en `src/app/layout.tsx` vía `next/script` con `strategy="beforeInteractive"` (no `afterInteractive` — hidrataba después de que `/bienvenida` pudiera intentar leer `window.fbq`, generando una condición de carrera de ~1s donde el evento nunca disparaba). Meta tag `facebook-domain-verification` con placeholder `PENDIENTE_REEMPLAZAR` — pendiente de reemplazar con el código real de Meta Business Manager → Configuración del negocio → Dominios.
- **El registro real ocurre en `klia-landing`** (otro repo, fuera del scope de esta sesión de `klia`), que llama a `POST /api/auth/registro` de esta app. Hay un `src/components/auth/RegisterForm.tsx` en este repo pero está **huérfano** (no lo importa nada) — no confundir con el form real.
- **Evento disparado en `src/app/bienvenida/BienvenidaClient.tsx`** (la pantalla "¡Tu cuenta está confirmada!", único punto de entrada real: `router.replace('/bienvenida')` desde `src/app/auth/confirm/page.tsx` tras confirmar el mail) — es la señal de conversión más confiable disponible en este repo, aunque más tardía en el funnel que el submit del formulario en la landing.
- **Guard server-side anti-duplicado**: RPC `marcar_meta_conversion_enviada()` (columna `profiles.meta_conversion_enviada`, migración `017_meta_conversion_dedup.sql`) hace un `UPDATE ... WHERE meta_conversion_enviada = false RETURNING true` atómico — race-safe, y solo devuelve `true` la primera vez. `SECURITY DEFINER` pero usa `auth.uid()` internamente (nunca recibe un id como parámetro), `GRANT EXECUTE` solo a `authenticated`.
- **Orden de la lógica en `BienvenidaClient.tsx`**: 1) `esperarFbq()` (polling cada 50ms, timeout 2s) antes de llamar a la RPC — si `fbq` nunca aparece, no se consume el guard (`meta_conversion_enviada` queda en `false`, permite reintentar en una futura visita); 2) recién si `fbq` está listo, llama a la RPC; 3) si la RPC confirma `esNuevo`, dispara `fbq('track', 'CompleteRegistration', ...)`.

## Webhook de notificación Pushover en nuevo registro (agregado 2026-07)

`POST /api/webhooks/nuevo-registro` — recibe el Database Webhook de Supabase configurado en `profiles` INSERT (formato estándar `{ type, table, schema, record, old_record }`), valida header `x-webhook-secret` contra `SUPABASE_WEBHOOK_SECRET` (401 sin llamar a Pushover si no matchea), arma un mensaje con `nombre + apellido / email / especialidad` (omite campos vacíos) y hace POST a la API de Pushover. La llamada a Pushover está en `try/catch` — si falla, solo loguea y de todos modos responde `200 { ok: true }`, para que Supabase no reintente el webhook por un problema nuestro de notificación. No lee ni escribe ninguna otra tabla.

**Importante — el trigger dispara en el registro, no en la confirmación de email.** `handle_new_user` inserta en `profiles` en el momento de `auth.users` INSERT (envío del formulario), no cuando se confirma el mail — `email_confirmed_at` vive en `auth.users`, no en `profiles`, así que un webhook sobre esta tabla no puede filtrar por mail confirmado. Decisión consciente por ahora: se prefiere el aviso inmediato aunque incluya registros que después nunca confirman el mail. Si se vuelve ruidoso, el punto de conversión real está en `src/app/auth/confirm/page.tsx`.

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
GEMINI_API_KEY, ORCHARD_API_KEY, CRON_SECRET,
SUPABASE_WEBHOOK_SECRET, PUSHOVER_API_TOKEN, PUSHOVER_USER_KEY

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
_Actualizado el 2026-08-10_

```
edd2ea3 feat: notificacion Pushover en nuevo registro de usuario
cbf58d1 feat: rediseña tabla de Prestadores en OPS — columna Código con tooltip en vez de Colegio, sin scroll horizontal, ordenamiento por header con URL
e7985f9 fix: corregir condición de carrera entre carga de fbq y guard de CompleteRegistration en /bienvenida
d81897f fix: evitar duplicar evento Meta CompleteRegistration en /bienvenida via guard server-side
faa60b3 feat: agregar Meta Pixel CompleteRegistration en flujo de registro
d677bd1 chore: agrega email de inactividad trial al endpoint de test-emails
92746bc feat: agrega tarjeta "En consultorio" a la barra de stats de Atenciones
eb88449 fix: completa el flujo de estado_atencion en Atenciones
b7cbe33 feat: calculador de PIO corregida para Oftalmología (corrección de Ehlers, StickyWidgetPIO)
2dd3832 fix: RxGrid actualiza la receta más reciente in-place en vez de crear una fila por campo
c1d7c07 fix: RxGrid pixel-perfect según diseño real (edición inline por celda, dropdown de historial, empty state), agrega columna ADD
a838351 feat: módulo de Refracción para Oftalmología (tab, SlideOver, API, componente RxGrid)
17096a1 feat: visor lightbox de imágenes en Archivos del Paciente
1e8b83c docs: documenta catálogo completo CIE-10 (8899 códigos) y actualiza ultimos cambios
8a9e5d4 feat: catálogo completo CIE-10 (8899 códigos) para campo de diagnóstico, carga perezosa
3ea4806 feat: rediseño mobile-first de pantalla Alta de Paciente
a0b0ba1 chore: commit vacio para verificar disparo de webhook de deploy en Vercel
deb0db9 chore: eliminar campo mp_subscription_id sin uso, corregir lectura de mp_preapproval_id en cuenta-bloqueada
e112887 chore: eliminar endpoint temporal de diagnóstico de precios, ya cumplió su función
18bcd94 fix: eliminar loop de redirects para cuentas canceladas, mostrar mensaje diferenciado de reactivacion
e9ca176 fix: no marcar suscripcion como cancelada si la llamada a preApproval.update falla, evita estado desincronizado con MP
b410893 fix: unificar creacion de suscripcion en una sola llamada a PreApproval con status authorized, elimina reuso de token
a68aad5 feat: reemplazar link Editar por iconos y agregar eliminacion de codigos de descuento con proteccion de uso
```
