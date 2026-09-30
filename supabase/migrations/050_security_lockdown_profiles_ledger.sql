-- 050 · Cierre de seguridad: correo del perfil y funciones del libro contable.
--
-- 1) profiles: el usuario podía editar su propia fila completa, correo
--    incluido, y los permisos (gerente/staff) se decidían por ese correo.
--    La app ya usa el correo de Auth (lib/auth/session.server.ts), y aquí se
--    deja editar solo columnas inofensivas. Ninguna pantalla edita el correo:
--    los perfiles se escriben desde el servidor (service_role).
--
-- 2) Funciones que mueven saldo: tenían EXECUTE para usuarios logueados (y,
--    por los permisos por defecto de Supabase, anónimos). Un cliente podía, por
--    ejemplo, devolverse a la cartera el saldo de una cuenta de anuncios sin
--    tocar TikTok. La app las llama siempre con service_role (lib/ledger).
--    Los triggers que usan ensure_* son SECURITY DEFINER y no se ven afectados.
--    No se tocan ledger_has_org_role (la usan políticas RLS) ni
--    ledger_touch_updated_at (trigger de fechas).

BEGIN;

-- 1) Correo del perfil
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, phone) ON public.profiles TO authenticated;

-- 2) Funciones del libro contable que mueven saldo
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ledger_post_two_sided',
        'ledger_confirm_deposit',
        'ledger_allocate_to_ad_account',
        'ledger_reserve_ad_account_budget',
        'ledger_release_ad_account_budget',
        'ledger_record_ad_spend',
        'ledger_refund_from_ad_account_to_wallet',
        'ledger_reverse_journal',
        'ensure_wallet_ledger_accounts',
        'ensure_ad_account_ledger_accounts'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

COMMIT;

-- Verificación (debe devolver false en las dos columnas para cada función):
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'execute') AS authenticated,
--        has_function_privilege('anon', p.oid, 'execute') AS anon
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND (p.proname LIKE 'ledger\_%' OR p.proname LIKE 'ensure\_%ledger%');
