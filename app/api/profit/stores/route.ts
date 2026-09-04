import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import {
  resolvePaymentsFundingCapabilities,
} from "@/lib/payments/funding-roles.server";
import { listActiveRpStores } from "@/lib/realprofit/profit-snapshot.server";

export const runtime = "nodejs";

/** Lista tiendas RP activas (picker staff). */
export async function GET() {
  const session = await requirePermission("adAccounts:read");
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json({ error: "Solo staff." }, { status: 403 });
  }

  try {
    const stores = await listActiveRpStores();
    return NextResponse.json({ ok: true, stores });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron listar tiendas.",
      },
      { status: 500 },
    );
  }
}
