-- Review TikTok post-publish (motivos de rechazo de anuncio/video).
-- Caso Creativos A1: no confundir con cuenta Suspendida (STATUS_LIMIT).

ALTER TABLE public.creative_publish_drafts
  ADD COLUMN IF NOT EXISTS review_status text
    CHECK (
      review_status IS NULL
      OR review_status IN ('pending', 'approved', 'rejected', 'unknown')
    ),
  ADD COLUMN IF NOT EXISTS reject_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_status text,
  ADD COLUMN IF NOT EXISTS review_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_creative_publish_drafts_review_poll
  ON public.creative_publish_drafts (status, review_status, published_at DESC)
  WHERE status = 'published';

COMMENT ON COLUMN public.creative_publish_drafts.review_status IS
  'Veredicto TikTok del anuncio (ad review), no status Holistic del draft.';
COMMENT ON COLUMN public.creative_publish_drafts.reject_reasons IS
  'reject_info[] / motivos de rechazo de /ad/review_info/.';
