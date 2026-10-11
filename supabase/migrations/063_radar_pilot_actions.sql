-- Piloto del Radar (Fase 5): registro de lo que el cliente confirmó o descartó.
-- Ver docs/PLAN_PROFIT_RADAR.md. Acceso solo desde el servidor con service_role.

CREATE TABLE IF NOT EXISTS public.radar_pilot_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hecom_cliente_id text NOT NULL,
  proposal_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pause_ad', 'dismiss')),
  advertiser_id text,
  ad_id text,
  status text NOT NULL CHECK (status IN ('done', 'failed')),
  error text,
  proposal jsonb NOT NULL DEFAULT '{}'::jsonb,
  tiktok_request_id text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_pilot_actions_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.radar_pilot_actions IS
  'Acciones del Piloto confirmadas por el cliente (pausar anuncio) o propuestas descartadas. Auditoría.';

CREATE INDEX IF NOT EXISTS idx_radar_pilot_actions_cliente
  ON public.radar_pilot_actions (hecom_cliente_id, created_at DESC);

ALTER TABLE public.radar_pilot_actions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.radar_pilot_actions TO service_role;
