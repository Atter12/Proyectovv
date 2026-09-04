-- TikTok pixels creados / sincronizados desde Ads Holistic (self-serve).

BEGIN;

CREATE TABLE IF NOT EXISTS public.tiktok_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hecom_cliente_id text NOT NULL,
  advertiser_id text NOT NULL,
  pixel_id text NOT NULL,
  pixel_code text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'error')),
  pixel_category text,
  events_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (advertiser_id, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_pixels_org
  ON public.tiktok_pixels(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_pixels_cliente
  ON public.tiktok_pixels(hecom_cliente_id, advertiser_id);

CREATE INDEX IF NOT EXISTS idx_tiktok_pixels_advertiser
  ON public.tiktok_pixels(advertiser_id);

ALTER TABLE public.tiktok_pixels ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la org (mismo patrón laxo que otras tablas ops).
DROP POLICY IF EXISTS tiktok_pixels_select_member ON public.tiktok_pixels;
CREATE POLICY tiktok_pixels_select_member
  ON public.tiktok_pixels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = tiktok_pixels.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS tiktok_pixels_insert_member ON public.tiktok_pixels;
CREATE POLICY tiktok_pixels_insert_member
  ON public.tiktok_pixels
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = tiktok_pixels.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS tiktok_pixels_update_member ON public.tiktok_pixels;
CREATE POLICY tiktok_pixels_update_member
  ON public.tiktok_pixels
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = tiktok_pixels.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = tiktok_pixels.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

COMMIT;
