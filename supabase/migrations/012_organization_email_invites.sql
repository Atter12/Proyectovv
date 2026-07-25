-- Acceso por correo: el admin invita el email del cliente a una organización.
-- Al registrarse / verificar, el usuario se une a ESA org (datos del cliente), no crea una vacía.

CREATE TABLE IF NOT EXISTS public.organization_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT organization_email_invites_email_not_blank CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_email_invites_org_email
  ON public.organization_email_invites (organization_id, email);

CREATE INDEX IF NOT EXISTS idx_organization_email_invites_email_pending
  ON public.organization_email_invites (lower(email), status)
  WHERE status = 'pending';

ALTER TABLE public.organization_email_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_email_invites_select_org ON public.organization_email_invites;
CREATE POLICY organization_email_invites_select_org
ON public.organization_email_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_email_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

GRANT SELECT ON public.organization_email_invites TO authenticated;
GRANT ALL ON public.organization_email_invites TO service_role;

COMMENT ON TABLE public.organization_email_invites IS
  'Invitaciones por correo a una organización cliente. Al registrarse con ese email + contraseña, se adjunta a la org (datos del cliente).';
