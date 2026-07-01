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

## Ultimos cambios
_Actualizado el 2026-06-13_

```
fd5bcd0 test: trigger push temporal para validar fix de pull rebase
99a0e58 fix: script CLAUDE.md - pull rebase antes del push para evitar non-fast-forward
ec8b475 chore: quitar trigger push temporal del workflow CLAUDE.md
23a84d8 docs: CLAUDE.md - commits del dia 2026-06-13
a16804e fix: agregar trigger push para forzar validacion en GitHub
95bc863 fix: workflow CLAUDE.md - mover logica a script bash separado
7e18109 fix: workflow CLAUDE.md - simplificar para compatibilidad con parser de GitHub
9083ae5 Update update-claude-md.yml
23e894b Update update-claude-md.yml
ba2c891 fix: workflow update-claude-md — corregir error YAML en heredoc
8d8326a feat: GitHub Action que actualiza Google Doc de módulos KLIA diariamente
0f6bcde docs: GitHub Action para actualizar CLAUDE.md diariamente
3505f38 feat: planes consumen modulos_config como fuente única
347828e fix: PlanFeaturesEditor filtra features por plan_id
```
