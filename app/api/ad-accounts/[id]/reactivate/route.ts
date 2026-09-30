import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { setAdAccountStatus } from "@/services/ad-accounts.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(session.permissions, "adAccounts:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  // Reactivar es cambiar el estado: igual que en PATCH, solo staff.
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json(
      { error: "Solo staff puede reactivar una cuenta publicitaria." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  try {
    await setAdAccountStatus(session, id, "active");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reactivar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
