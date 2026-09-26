import { NextResponse } from "next/server";
import { documentTokenFromWebhook, verifySignatureHmac } from "@/features/alliances/lib/signature";
import { syncSignatureByExternalRef } from "@/features/alliances/lib/signature-sync.server";
import { serverEnv } from "@/lib/env/env.server";

export async function POST(request: Request) {
  const secret = serverEnv.firmeasyWebhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook de firma no configurado." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-firmeasy-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("x-hub-signature-256");
  if (!verifySignatureHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const token = documentTokenFromWebhook(payload);
  if (!token) return NextResponse.json({ ok: true, ignored: true });

  const synced = await syncSignatureByExternalRef(token);
  if (!synced.ok) return NextResponse.json({ error: synced.error }, { status: 500 });
  return NextResponse.json({ ok: true, ignored: Boolean(synced.ignored) });
}
