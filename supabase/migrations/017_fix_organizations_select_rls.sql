-- 017: organizations tenía RLS activado sin políticas → SELECT denegado.
-- Eso rompe getSession (join memberships→organizations) y causa bucle
-- overview ⇄ account-setup (pantalla blanca / Throttling navigation).

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
FOR SELECT TO authenticated
USING (public.is_org_member(id));

GRANT SELECT ON public.organizations TO authenticated;
