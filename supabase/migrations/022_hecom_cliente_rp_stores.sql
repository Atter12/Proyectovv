-- Vínculo cliente Hecom ↔ tienda Real Profit (vista promo ROAS en Ads Holistic).

BEGIN;

CREATE TABLE IF NOT EXISTS public.hecom_cliente_rp_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hecom_cliente_id text NOT NULL,
  rp_store_id uuid NOT NULL REFERENCES public.rp_stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hecom_cliente_id, rp_store_id)
);

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_rp_stores_cliente
  ON public.hecom_cliente_rp_stores(hecom_cliente_id);

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_rp_stores_store
  ON public.hecom_cliente_rp_stores(rp_store_id);

ALTER TABLE public.hecom_cliente_rp_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hecom_cliente_rp_stores_select_member ON public.hecom_cliente_rp_stores;
CREATE POLICY hecom_cliente_rp_stores_select_member
  ON public.hecom_cliente_rp_stores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS hecom_cliente_rp_stores_write_member ON public.hecom_cliente_rp_stores;
CREATE POLICY hecom_cliente_rp_stores_write_member
  ON public.hecom_cliente_rp_stores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

COMMIT;
