# KLIA — App

## Project
SaaS platform for healthcare professionals in Argentina.
Repository: dibrand-dev/klia
Production: https://app.klia.com.ar
Super Admin panel: https://app.klia.com.ar/ops/login

## Stack
- Next.js 14 App Router + TypeScript
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Tailwind CSS
- Vercel (CI/CD from main branch)
- Mercado Pago (Checkout Bricks for subscriptions)
- Google Calendar API (OAuth bidirectional sync)
- Brevo API (transactional emails from hola@klia.com.ar)
- pdfkit (PDF generation for OS planillas)

## Key rules
- Always show SQL before executing in Supabase
- Always run `npm run build` before committing
- Never use `window.confirm()` — use ConfirmDialog component
- Never hardcode prices — read from Supabase `configuracion` table
- Always commit with descriptive message in format: `feat/fix/chore: description`
- Super Admin auth is separate: /ops/login → checks admin_users table
- Emails always sent via Brevo, never via Supabase default templates

## CRITICAL — Mandatory testing after auth/middleware changes

Any change to these files REQUIRES completing the full registration+login test before pushing to main:

**Critical files:**
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/app/api/auth/registro/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/auth/callback/page.tsx`
- `src/app/login/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- Any file touching `profiles`, `auth.users`, or RLS policies

**Critical Supabase functions:**
- `handle_new_user()` — profile creation trigger
- `trigger_generar_booking_slug()` — slug trigger
- Any RLS policy on `profiles`

**Minimum test checklist (all steps must pass):**
1. Register new user with a test email
2. Verify confirmation email arrives
3. Confirm email → verify redirect to `/bienvenida`
4. Verify profile was created correctly in `profiles`
5. Login with that user
6. Verify dashboard loads correctly
7. Delete test user when done

If any step fails → do NOT push to main until resolved.

## Auth flow
- Professional login: www.klia.com.ar/login → app.klia.com.ar/auth/callback → /dashboard
- Super Admin login: app.klia.com.ar/ops/login → /ops/dashboard
- Google OAuth: handled by Supabase, redirects to /auth/callback

## Key files
- src/middleware.ts — route protection with PUBLIC_ROUTES list
- src/app/auth/callback/route.ts — post-login redirect logic
- src/lib/brevo.ts — email client
- src/lib/email-templates.ts — 7 email templates
- src/lib/mercadopago.ts — MP config and plan prices
- src/lib/google-calendar.ts — Google Calendar helpers
- src/lib/sync-google-calendar.ts — sync functions
- src/lib/deuda.ts — debt calculation logic
- src/lib/monedas.ts — multi-currency helpers
- src/lib/recurrentes.ts — recurring appointment logic
- src/lib/planillas/ — PDF generators per OS

## Database
- Supabase project: bdokvwturcbebsjxtbpi
- RLS enabled on all tables
- Storage buckets: firmas-profesionales, firmas-pacientes (both private)
- Key tables: profiles, pacientes, turnos, turnos_recurrentes, entrevistas,
  notas_clinicas, google_calendar_tokens, profesional_obras_sociales,
  planilla_templates, suscripciones, admin_users, configuracion

## Environment variables (all set in Vercel)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY,
MP_PUBLIC_KEY_TEST, MP_ACCESS_TOKEN_TEST,
MP_PUBLIC_KEY_PROD, MP_ACCESS_TOKEN_PROD,
MP_CLIENT_ID, MP_CLIENT_SECRET, MP_WEBHOOK_SECRET,
MP_USE_PRODUCTION, NEXT_PUBLIC_APP_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
