import "server-only";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import {
  isHecomOtpLoginEnabled,
  isHecomOtpStaffEmail,
  resolveHecomClientesForEmail,
  userMayAccessHecomCliente,
} from "@/lib/auth/hecom-otp.server";
import type { SessionUser } from "@/types/auth";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export async function assertHecomClienteAccess(
  session: SessionUser,
  clienteId: string,
): Promise<void> {
  const normalizedClienteId = String(clienteId ?? "").trim();
  if (!normalizedClienteId) {
    throw new Error("Cliente inválido.");
  }

  const isAdmin = userIsAllowedAdmin({
    id: session.id,
    email: session.email,
  });
  const isStaff = isHecomOtpStaffEmail(session.email);

  if (isAdmin || isStaff) {
    const selected = await getSelectedHecomCliente(session.id);
    if (selected?.id && selected.id !== normalizedClienteId) {
      throw new Error("El cobro no corresponde al cliente en alcance.");
    }
    return;
  }

  if (isHecomOtpLoginEnabled()) {
    const allowed = await resolveHecomClientesForEmail(session.email);
    const linkedIds = allowed.map((item) => item.id);
    if (
      !userMayAccessHecomCliente({
        isAdmin,
        isStaff,
        linkedClienteIds: linkedIds,
        clienteId: normalizedClienteId,
      })
    ) {
      throw new Error("No tenés acceso a este cliente.");
    }
    return;
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id || selected.id !== normalizedClienteId) {
    throw new Error("No tenés acceso a este cliente.");
  }
}
