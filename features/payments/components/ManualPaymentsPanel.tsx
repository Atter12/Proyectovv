import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { ManualVoucherReviewHost } from "@/features/payments/components/ManualVoucherReviewHost";
import type { SessionUser } from "@/types/auth";

/** @deprecated Prefer ManualVoucherReviewHost + /payments/manual. */
export async function ManualPaymentsPanel({
  session,
}: {
  session: SessionUser;
}) {
  const caps = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) return null;

  return (
    <ManualVoucherReviewHost
      staffMode={caps.isStaff || caps.isSuperAdmin}
      hecomClienteId={selected.id}
      clienteName={selected.name}
    />
  );
}
