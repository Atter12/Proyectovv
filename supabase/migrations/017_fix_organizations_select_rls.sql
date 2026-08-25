-- 017: organizations tenía RLS activado sin políticas → SELECT denegado.
-- Eso rompe getSession (join memberships→organizations) y causa bucle
-- overview ⇄ account-setup (pantalla blanca / Throttling navigation).
-- Nota: 018 corrige is_org_member → user_has_org_access si 017 ya corrió.

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
FOR SELECT TO authenticated
USING (public.user_has_org_access(id));

GRANT SELECT ON public.organizations TO authenticated;
