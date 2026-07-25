import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { inviteClientEmail, revokeClientEmailInvite } from "@/lib/admin/data";

export async function POST(request: Request) {
  const adminSession = await requireAdmin();
  let body: { organizationId?: string; email?: string; role?: string };
  try {
    body = (await request.json()) as {
      organizationId?: string;
      email?: string;
      role?: string;
    };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.organizationId || !body.email) {
    return NextResponse.json(
      { error: "organizationId y email son obligatorios." },
      { status: 400 },
    );
  }

  const result = await inviteClientEmail({
    organizationId: body.organizationId,
    email: body.email,
    role: body.role ?? "owner",
    invitedBy: adminSession.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, invite: result.invite });
}

export async function DELETE(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get("inviteId");
  const organizationId = searchParams.get("organizationId");

  if (!inviteId || !organizationId) {
    return NextResponse.json(
      { error: "inviteId y organizationId son obligatorios." },
      { status: 400 },
    );
  }

  const result = await revokeClientEmailInvite(inviteId, organizationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
