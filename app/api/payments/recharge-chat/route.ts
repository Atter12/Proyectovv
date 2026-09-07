import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getRechargeChatSnapshot,
  handleRechargeMessage,
  type RechargeChatState,
} from "@/lib/payments/yape/recharge-chat.server";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 500;
const VALID_STATES: RechargeChatState[] = [
  "idle",
  "awaiting_amount",
  "awaiting_payment",
];

async function authorize() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return { error: NextResponse.json({ error: "Permiso denegado." }, { status: 403 }) };
  }
  return { session };
}

/** Estado del bot al abrir el chat: retoma una recarga en curso si la hay. */
export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;

  try {
    return NextResponse.json({ ok: true, ...(await getRechargeChatSnapshot(auth.session)) });
  } catch (error) {
    // El bot nunca debe romper el chat de soporte: si falla, no se hace cargo
    // y el mensaje sigue su curso normal hacia el gerente.
    console.error("[recharge-chat] snapshot", error);
    return NextResponse.json({ ok: true, handled: false, state: "idle", replies: [] });
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  let body: { message?: unknown; state?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body.message !== "string" || body.message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }

  const clientState =
    typeof body.state === "string" &&
    VALID_STATES.includes(body.state as RechargeChatState)
      ? (body.state as RechargeChatState)
      : undefined;

  try {
    const result = await handleRechargeMessage({
      session: auth.session,
      message: body.message,
      clientState,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[recharge-chat] message", error);
    return NextResponse.json({ ok: true, handled: false, state: "idle", replies: [] });
  }
}
