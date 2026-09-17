-- A2: vincular draft de corrección al anuncio rechazado por TikTok.

ALTER TABLE public.creative_publish_drafts
  ADD COLUMN IF NOT EXISTS parent_draft_id uuid
    REFERENCES public.creative_publish_drafts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creative_publish_drafts_parent
  ON public.creative_publish_drafts (parent_draft_id)
  WHERE parent_draft_id IS NOT NULL;

COMMENT ON COLUMN public.creative_publish_drafts.parent_draft_id IS
  'Draft rechazado que esta versión corrige (re-upload / re-publish).';
