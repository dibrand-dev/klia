-- Deduplicate before adding constraint: keep the row with highest veces_ingresada per nombre
DELETE FROM public.obras_sociales
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY nombre
             ORDER BY veces_ingresada DESC, validada DESC, created_at ASC
           ) AS rn
    FROM public.obras_sociales
  ) t
  WHERE rn > 1
);

-- Ensure IOMA, Hospital Italiano, Hominis are validated
UPDATE public.obras_sociales
SET validada = true
WHERE nombre IN ('IOMA', 'Hospital Italiano', 'Hominis')
  AND validada = false;

-- Add unique constraint on nombre (case-insensitive via citext or lower())
ALTER TABLE public.obras_sociales
  ADD CONSTRAINT obras_sociales_nombre_unique UNIQUE (nombre);
