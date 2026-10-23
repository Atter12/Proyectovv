-- Sugerencias de la optimización diaria sobre las campañas lanzadas
-- (campaign_launches). El equipo las aprueba o descarta; en modo auto se
-- aplican solas. Lo aplicado o descartado no se vuelve a proponer por 7 días.
-- Acceso solo desde el servidor con service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.campaign_optimization_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  launch_id uuid NOT NULL REFERENCES public.campaign_launches(id) ON DELETE CASCADE,
  -- Llave estable de la acción (p. ej. pause:<campaña>:<video>); no se repite por campaña
  action_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pause_video', 'new_video', 'all_losing', 'raise_budget')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'applied', 'dismissed', 'failed', 'expired')),
  data_through date,
  error text,
  tiktok_request_id text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_optimization_actions_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_optimization_actions_key_unique UNIQUE (launch_id, action_key)
);

COMMENT ON TABLE public.campaign_optimization_actions IS
  'Sugerencias diarias (pausar video, subir presupuesto, cambiar video) sobre campañas lanzadas desde Ads Holistic.';

CREATE INDEX IF NOT EXISTS idx_campaign_optimization_actions_status
  ON public.campaign_optimization_actions (status, created_at DESC);

ALTER TABLE public.campaign_optimization_actions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.campaign_optimization_actions TO service_role;

COMMIT;
