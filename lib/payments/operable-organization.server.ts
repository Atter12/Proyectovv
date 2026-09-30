import "server-only";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import type { SessionUser } from "@/types/auth";

/**
 * ¿La sesión puede mover saldo en esta org?
 *
 * Las rutas de asignar/recuperar/transferir toman la org de la cuenta ads que
 * manda el navegador. Sin este control, un cliente con el id de una cuenta
 * ajena operaba la cartera de otro. Se permite solo:
 * - la org de la sesión, o
 * - la org de la ficha Hecom elegida (la misma que usa el panel de Pagos para
 *   la cartera). getSelectedHecomCliente ya valida que la sesión tenga acceso a
 *   esa ficha: staff/“ver como” a cualquiera, cliente solo a las suyas.
 */
export async function sessionMayOperateOnOrganization(
  session: SessionUser,
  organizationId: string,
): Promise<boolean> {
  const target = organizationId.trim();
  if (!target) return false;
  if (session.organizationId && session.organizationId === target) return true;

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) return false;
  const clienteOrgId = await resolveOrganizationIdForHecomCliente(selected.id);
  return Boolean(clienteOrgId) && clienteOrgId === target;
}
