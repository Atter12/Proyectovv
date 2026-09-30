import { NextResponse } from "next/server";
import { syncRegistrationSignature } from "@/features/contracts/lib/registration-signature-sync.server";
import { documentTokenFromWebhook, verifySignatureHmac } from "@/features/contracts/lib/signature";
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

  const registration = await syncRegistrationSignature(token);
  if (!registration.ok) return NextResponse.json({ error: registration.error }, { status: 500 });
  return NextResponse.json({ ok: true, ignored: Boolean(registration.ignored) });
}
