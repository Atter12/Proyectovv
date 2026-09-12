import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { pollYapeMailboxThrottled } from "@/lib/payments/yape/poll-mailbox.server";
import {
  getBotIntentStatus,
  getPendingRecharge,
  handleRechargeMessage,
  type RechargeChatState,
} from "@/lib/payments/yape/recharge-chat.server";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 500;
const VALID_STATES: RechargeChatState[] = ["idle", "awaiting_amount", "awaiting_payment"];

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

/**
 * Recarga en curso del usuario (a dónde va una captura) y, con ?intentId=,
 * el estado de esa recarga para avisar en el chat cuando entra el saldo.
 */
export async function GET(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  try {
    const intentId = new URL(request.url).searchParams.get("intentId");
    const pending = await getPendingRecharge(auth.session);

    // Con una recarga esperando al banco se revisa el correo en el momento en
    // vez de esperar al cron. El throttle evita abrir IMAP en cada consulta.
    if (pending?.status === "processing") {
      await pollYapeMailboxThrottled();
    }

    const intent = intentId ? await getBotIntentStatus(auth.session, intentId) : null;
    return NextResponse.json({ ok: true, pending, intent });
  } catch (error) {
    // El bot nunca debe romper el chat de soporte.
    console.error("[recharge-chat] consulta", error);
    return NextResponse.json({ ok: true, pending: null, intent: null });
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
    typeof body.state === "string" && VALID_STATES.includes(body.state as RechargeChatState)
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
    // Si el bot falla, no se hace cargo y el mensaje sigue al gerente.
    console.error("[recharge-chat] mensaje", error);
    return NextResponse.json({ ok: true, handled: false, state: "idle", replies: [] });
  }
}
