import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import {
  isHecomOtpLoginEnabled,
  provisionHecomClienteAccess,
} from "@/lib/auth/hecom-otp.server";

export async function POST() {
  if (!isHecomOtpLoginEnabled()) {
    return NextResponse.json({ error: "OTP Hecom deshabilitado." }, { status: 403 });
  }

  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const provisioned = await provisionHecomClienteAccess({
      userId: session.id,
      email: session.email,
    });
    return NextResponse.json({
      ok: true,
      clienteIds: provisioned.clienteIds,
      clientes: provisioned.clientes,
      autoSelected: provisioned.autoSelected,
      needsPicker: provisioned.needsPicker,
      nextPath: provisioned.nextPath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo vincular Hecom.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
