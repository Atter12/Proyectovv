import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  const endpoint = body?.endpoint?.trim() ?? "";
  const p256dh = body?.keys?.p256dh?.trim() ?? "";
  const auth = body?.keys?.auth?.trim() ?? "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción incompleta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("web_push_subscriptions").upsert(
    {
      user_id: session.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[web-push] no se guardó la suscripción", error);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
