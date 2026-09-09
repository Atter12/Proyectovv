-- Aprobación gerencia para crédito Holistic (pedido → aprobado / rechazado).

BEGIN;

ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'none'
    CHECK (approval_status IN ('none', 'requested', 'approved', 'rejected'));

ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS requested_at timestamptz;

ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Cupos ya existentes (pre-aprobación) → abuelo como approved (no romper clientes vivos).
UPDATE public.credit_lock_profiles
SET approval_status = 'approved',
    requested_at = COALESCE(requested_at, updated_at, created_at, now()),
    reviewed_at = COALESCE(reviewed_at, now())
WHERE requested_credit_cents IS NOT NULL
  AND approval_status = 'none';

COMMIT;
