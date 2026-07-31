-- Hecom OTP client access: link auth users ↔ Hecom clientes + rate limit OTP.

CREATE TABLE IF NOT EXISTS public.hecom_cliente_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hecom_cliente_id text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hecom_cliente_user_links_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT hecom_cliente_user_links_cliente_not_blank CHECK (btrim(hecom_cliente_id) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hecom_cliente_user_links_user_cliente
  ON public.hecom_cliente_user_links (user_id, hecom_cliente_id);

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_user_links_email
  ON public.hecom_cliente_user_links (lower(email));

CREATE INDEX IF NOT EXISTS idx_hecom_cliente_user_links_cliente
  ON public.hecom_cliente_user_links (hecom_cliente_id);

CREATE TABLE IF NOT EXISTS public.hecom_otp_rate_limits (
  email text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1
);

ALTER TABLE public.hecom_cliente_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hecom_otp_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hecom_cliente_user_links_select_own ON public.hecom_cliente_user_links;
CREATE POLICY hecom_cliente_user_links_select_own
ON public.hecom_cliente_user_links
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT ON public.hecom_cliente_user_links TO authenticated;
GRANT ALL ON public.hecom_cliente_user_links TO service_role;
GRANT ALL ON public.hecom_otp_rate_limits TO service_role;

COMMENT ON TABLE public.hecom_cliente_user_links IS
  'Maps Supabase auth users to Hecom Club cliente IDs after OTP login.';
COMMENT ON TABLE public.hecom_otp_rate_limits IS
  'Simple cooldown for Hecom client OTP email sends.';
