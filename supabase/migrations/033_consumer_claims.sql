-- Libro de reclamaciones (INDECOPI). Solo el service role escribe.
CREATE TABLE IF NOT EXISTS public.consumer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code text NOT NULL UNIQUE,
  claim_type text NOT NULL CHECK (claim_type IN ('reclamo', 'queja')),
  consumer_name text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  is_minor boolean NOT NULL DEFAULT false,
  guardian_name text,
  product text NOT NULL,
  amount_text text,
  detail text NOT NULL,
  request text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consumer_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.consumer_claims IS
  'Libro de reclamaciones virtual. Conservar al menos 2 años.';
