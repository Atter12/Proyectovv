import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { listInboxTickets } from "@/lib/support/support-inbox.server";

export const runtime = "nodejs";

function assertStaff(email: string, role: string | null | undefined) {
  const funding = resolvePaymentsFundingCapabilities({ email, role });
  return funding.isStaff || funding.isSuperAdmin;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json(
      { error: "Solo gerentes pueden ver el inbox." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const q = searchParams.get("q") ?? "";

  const tickets = await listInboxTickets({
    status,
    q,
    assignedUserId: session.id,
  });
  return NextResponse.json({ ok: true, tickets, me: { id: session.id, email: session.email } });
}
