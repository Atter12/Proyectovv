-- Real Profit COD monthly entitlement (Holistic +$20 voucher).

BEGIN;

CREATE TABLE IF NOT EXISTS public.hecom_cliente_realprofit_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hecom_cliente_id text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'active', 'expired', 'rejected')),
  active_from timestamptz,
  active_until timestamptz,
  last_payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hecom_cliente_realprofit_subs_cliente
  ON public.hecom_cliente_realprofit_subs(hecom_cliente_id);

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_realprofit_subs_status
  ON public.hecom_cliente_realprofit_subs(status);

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_realprofit_subs_until
  ON public.hecom_cliente_realprofit_subs(active_until)
  WHERE status = 'active';

ALTER TABLE public.hecom_cliente_realprofit_subs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hecom_cliente_realprofit_subs_select_member
  ON public.hecom_cliente_realprofit_subs;
CREATE POLICY hecom_cliente_realprofit_subs_select_member
  ON public.hecom_cliente_realprofit_subs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS hecom_cliente_realprofit_subs_write_member
  ON public.hecom_cliente_realprofit_subs;
CREATE POLICY hecom_cliente_realprofit_subs_write_member
  ON public.hecom_cliente_realprofit_subs
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
