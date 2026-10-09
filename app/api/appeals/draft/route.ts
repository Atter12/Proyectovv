import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  draftAppealMessage,
  getTikTokSuspension,
  resolveClienteAdAccount,
} from "@/lib/appeals/account-appeals.server";

export const runtime = "nodejs";

/** Mensaje de apelación en inglés con IA a partir de lo que el cliente llenó. */
export async function POST(request: Request) {
  const session = await requirePermission("payments:read");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).slice(0, 2000) : "");
  try {
    const account = await resolveClienteAdAccount({
      hecomClienteId: selected.id,
      adAccountId: str("adAccountId").trim(),
    });
    const suspension = await getTikTokSuspension(account.advertiserId);
    const draft = await draftAppealMessage({
      advertiserId: account.advertiserId,
      accountName: account.name,
      companyName: str("companyName") || selected.name || "our client",
      taxId: str("taxId"),
      storeUrl: str("storeUrl"),
      products: str("products"),
      notes: str("notes"),
      suspensionReason: suspension.reason,
      attachmentNames: Array.isArray(body.attachmentNames)
        ? (body.attachmentNames as unknown[]).map(String).slice(0, 6)
        : [],
    });
    return NextResponse.json({ ok: true, ...draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el mensaje.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
