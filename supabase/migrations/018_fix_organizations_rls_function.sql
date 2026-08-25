-- 018: Corregir política de organizations (017 usaba is_org_member inexistente).

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
FOR SELECT TO authenticated
USING (public.user_has_org_access(id));

GRANT SELECT ON public.organizations TO authenticated;
