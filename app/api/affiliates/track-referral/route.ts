import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/records";

interface TrackReferralBody {
  code?: unknown;
  event?: unknown;
}

export async function POST(request: Request) {
  let body: TrackReferralBody;
  try {
    body = (await request.json()) as TrackReferralBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Código requerido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: referralCode, error } = await admin
    .from("referral_codes")
    .select("id, metadata")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!referralCode) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const metadata = isRecord(referralCode.metadata) ? referralCode.metadata : {};
  const clicks = Number(metadata.clicks ?? 0);
  const safeClicks = Number.isFinite(clicks) && clicks >= 0 ? clicks : 0;

  await admin
    .from("referral_codes")
    .update({
      metadata: {
        ...metadata,
        clicks: safeClicks + 1,
        last_clicked_at: new Date().toISOString(),
        last_event: typeof body.event === "string" ? body.event : "click",
      },
    })
    .eq("id", referralCode.id);

  return NextResponse.json({ ok: true, tracked: true });
}
