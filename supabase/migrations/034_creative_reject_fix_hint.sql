-- Consejo corto de IA para pasar review TikTok (cache, no se regenera en cada pageview).

ALTER TABLE public.creative_publish_drafts
  ADD COLUMN IF NOT EXISTS reject_fix_hint text;

COMMENT ON COLUMN public.creative_publish_drafts.reject_fix_hint IS
  'Frase cacheada: qué cambiar en el video para que TikTok acepte el anuncio.';
