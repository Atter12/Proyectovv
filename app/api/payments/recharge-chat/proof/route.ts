import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { processBotVoucher } from "@/lib/payments/yape/bot-voucher.server";
import { RechargeBotUserError } from "@/lib/payments/yape/recharge-chat.server";

export const runtime = "nodejs";
// Análisis con IA + revisión del correo del banco en la misma llamada.
export const maxDuration = 60;

/** Captura del chat del bot: comprobante de la recarga en curso. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const intentId = form.get("intentId");
  const proof = form.get("proof");
  if (typeof intentId !== "string" || !intentId || !(proof instanceof File)) {
    return NextResponse.json({ error: "Adjunta la captura de tu yapeo." }, { status: 400 });
  }

  try {
    const result = await processBotVoucher({ session, intentId, file: proof });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RechargeBotUserError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[recharge-chat/proof]", error);
    return NextResponse.json(
      { error: "No pude procesar tu comprobante. Inténtalo de nuevo en un momento." },
      { status: 500 },
    );
  }
}
