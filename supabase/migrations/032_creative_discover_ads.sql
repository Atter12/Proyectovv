-- Descubrir ads de Ads Manager (rechazados) en Creativos.
-- Complementa drafts publicados desde Holistic.

ALTER TABLE public.creative_publish_drafts
  ADD COLUMN IF NOT EXISTS external_ad_id text,
  ADD COLUMN IF NOT EXISTS discover_source text
    CHECK (
      discover_source IS NULL
      OR discover_source IN ('holistic', 'tiktok_ads_manager')
    );

-- Backfill desde publish_result.ad_id
UPDATE public.creative_publish_drafts
SET external_ad_id = NULLIF(trim(publish_result->>'ad_id'), '')
WHERE external_ad_id IS NULL
  AND publish_result ? 'ad_id'
  AND NULLIF(trim(publish_result->>'ad_id'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_publish_drafts_org_ext_ad
  ON public.creative_publish_drafts (organization_id, external_ad_id)
  WHERE external_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creative_publish_drafts_discover_rejected
  ON public.creative_publish_drafts (organization_id, review_status, updated_at DESC)
  WHERE status = 'published' AND review_status = 'rejected';

COMMENT ON COLUMN public.creative_publish_drafts.external_ad_id IS
  'TikTok ad_id (publish Holistic o import Ads Manager).';
COMMENT ON COLUMN public.creative_publish_drafts.discover_source IS
  'holistic = creado desde Creativos; tiktok_ads_manager = descubierto en Ads Manager.';
