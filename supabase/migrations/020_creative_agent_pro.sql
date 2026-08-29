-- Creativos Agent Pro: vínculo advertiser + drafts de publicación.

ALTER TABLE public.creative_assets
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_advertiser_id text;

CREATE INDEX IF NOT EXISTS idx_creative_assets_ad_account
  ON public.creative_assets(ad_account_id)
  WHERE ad_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creative_assets_advertiser
  ON public.creative_assets(external_advertiser_id)
  WHERE external_advertiser_id IS NOT NULL;

ALTER TABLE public.creative_analysis_jobs
  ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'analyze';

ALTER TABLE public.creative_analysis_results
  ADD COLUMN IF NOT EXISTS creative_asset_id uuid REFERENCES public.creative_assets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.creative_publish_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creative_asset_id uuid REFERENCES public.creative_assets(id) ON DELETE SET NULL,
  analysis_job_id uuid REFERENCES public.creative_analysis_jobs(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  external_advertiser_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'rejected', 'publishing', 'published', 'failed')),
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  publish_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creative_publish_drafts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_publish_drafts_org_status
  ON public.creative_publish_drafts(organization_id, status, created_at DESC);

ALTER TABLE public.creative_publish_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creative_publish_drafts_select_member ON public.creative_publish_drafts;
CREATE POLICY creative_publish_drafts_select_member ON public.creative_publish_drafts
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS creative_publish_drafts_insert_member ON public.creative_publish_drafts;
CREATE POLICY creative_publish_drafts_insert_member ON public.creative_publish_drafts
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS creative_publish_drafts_update_member ON public.creative_publish_drafts;
CREATE POLICY creative_publish_drafts_update_member ON public.creative_publish_drafts
FOR UPDATE USING (public.user_has_org_access(organization_id))
WITH CHECK (public.user_has_org_access(organization_id));

GRANT SELECT, INSERT, UPDATE ON public.creative_publish_drafts TO authenticated;
