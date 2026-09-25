import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import {
  canSwitchTesterDashboardMode,
  parseTesterDashboardMode,
} from "@/lib/auth/tester-dashboard-mode";
import { setTesterDashboardMode } from "@/lib/auth/tester-dashboard-mode.server";

export const dynamic = "force-dynamic";

/** Alterna el panel gerente/cliente. Solo la cuenta tester. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!canSwitchTesterDashboardMode(session.email)) {
    return NextResponse.json(
      { ok: false, error: "Esta cuenta no puede cambiar de modo." },
      { status: 403 },
    );
  }

  let body: { mode?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (body.mode !== "cliente" && body.mode !== "gerente") {
    return NextResponse.json({ ok: false, error: "Modo inválido." }, { status: 400 });
  }

  const mode = parseTesterDashboardMode(body.mode);
  await setTesterDashboardMode(mode);
  return NextResponse.json({ ok: true, mode });
}
