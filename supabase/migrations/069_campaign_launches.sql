-- Campañas Smart+ lanzadas desde Ads Holistic ("Lanzar campaña" en Creativos).
-- La optimización diaria (sugerir y luego aplicar) solo actúa sobre estas:
-- las campañas que el cliente arma por su cuenta en Ads Manager no se tocan.
-- Acceso solo desde el servidor con service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.campaign_launches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hecom_cliente_id text,
  ad_account_id uuid,
  advertiser_id text NOT NULL,
  campaign_id text NOT NULL,
  adgroup_id text,
  ad_id text,
  campaign_name text NOT NULL,
  daily_budget numeric(12, 2) NOT NULL,
  country text NOT NULL,
  pixel_id text,
  video_ids text[] NOT NULL DEFAULT '{}',
  -- suggest: solo propone · auto: aplica solo (se enciende cuando el equipo confíe en las reglas)
  optimize_mode text NOT NULL DEFAULT 'suggest' CHECK (optimize_mode IN ('off', 'suggest', 'auto')),
  -- Techo para subir presupuesto sin preguntar (null = el doble del inicial)
  max_daily_budget numeric(12, 2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_launches_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_launches_campaign_unique UNIQUE (advertiser_id, campaign_id)
);

COMMENT ON TABLE public.campaign_launches IS
  'Campañas Smart+ creadas con "Lanzar campaña". Únicas que la optimización diaria puede tocar.';

CREATE INDEX IF NOT EXISTS idx_campaign_launches_cliente
  ON public.campaign_launches (hecom_cliente_id, created_at DESC);

ALTER TABLE public.campaign_launches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.campaign_launches TO service_role;

COMMIT;
