-- Access token de Events API generado por Ads Holistic (TikTok no tiene API para crearlo).
-- El cliente manda eventos a /api/tiktok/open_api/v1.3/event/track con este token; el servidor
-- revisa que sea de ese píxel y los reenvía a TikTok con el token de la agencia.
-- Solo se guarda el hash: el token se muestra una vez, como en TikTok.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tiktok_pixel_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hecom_cliente_id text NOT NULL,
  pixel_id text NOT NULL,
  pixel_code text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  events_sent bigint NOT NULL DEFAULT 0
);

-- Un solo token vigente por píxel: generar otro anula el anterior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiktok_pixel_tokens_active
  ON public.tiktok_pixel_tokens(pixel_code)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_tokens_cliente
  ON public.tiktok_pixel_tokens(hecom_cliente_id, pixel_code);

-- Sin políticas: solo el service role (servidor) lee y escribe.
ALTER TABLE public.tiktok_pixel_tokens ENABLE ROW LEVEL SECURITY;

-- Suma de eventos reenviados sin carrera entre requests.
CREATE OR REPLACE FUNCTION public.tiktok_pixel_token_used(p_id uuid, p_events integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tiktok_pixel_tokens
     SET last_used_at = now(), events_sent = events_sent + GREATEST(p_events, 0)
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.tiktok_pixel_token_used(uuid, integer) FROM PUBLIC, anon, authenticated;

COMMIT;
