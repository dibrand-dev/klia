-- Tabla de pagos individuales de suscripción (cada cobro recurrente de MP),
-- separada de `suscripciones` (que registra la suscripción/preapproval, no
-- cada cobro). El webhook de MP para `subscription_authorized_payment` nunca
-- se manejaba — se descartaba como "notificacion no manejada" — por eso no
-- existía ningún registro de pagos individuales hasta ahora.
CREATE TABLE IF NOT EXISTS public.pagos_suscripcion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  suscripcion_id uuid REFERENCES public.suscripciones(id) ON DELETE SET NULL,
  mp_payment_id text UNIQUE NOT NULL,
  mp_preapproval_id text,
  plan text,
  monto_bruto numeric(12,2) NOT NULL,
  monto_neto numeric(12,2),
  moneda text NOT NULL DEFAULT 'ARS',
  estado text NOT NULL,
  fecha_pago timestamptz NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_fecha_pago ON public.pagos_suscripcion (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_terapeuta ON public.pagos_suscripcion (terapeuta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_suscripcion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_suscripcion TO service_role;

ALTER TABLE public.pagos_suscripcion ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe (lo hace el webhook con createServiceClient).
-- Ningún profesional puede ver ni modificar pagos de otros desde el cliente
-- — esta tabla es exclusivamente para OPS, que también lee vía service_role
-- (requireAdminUser + createServiceClient, mismo patrón que el resto de /ops),
-- así que no hace falta una policy de SELECT para `authenticated` acá.
CREATE POLICY "service_role gestiona pagos_suscripcion" ON public.pagos_suscripcion
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Flag para excluir cuentas de prueba de las métricas de ingresos de OPS.
-- Se eligió un flag en `profiles` (editable por fila desde OPS) en vez de una
-- lista de emails en `configuracion_global`, porque esa tabla es singleton
-- (una sola fila de config global) y no se presta a listas que crecen.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS es_cuenta_prueba boolean NOT NULL DEFAULT false;
