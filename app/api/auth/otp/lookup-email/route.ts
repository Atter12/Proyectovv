import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findHecomClientesByName } from "@/lib/hecom/clientes.server";
import { normalizeHecomOtpEmail } from "@/lib/auth/hecom-otp-email";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";

const LOOKUP_COOLDOWN_SECONDS = 8;
const MIN_NAME_LEN = 4;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || "unknown";
}

function maskEmailDisplay(email: string): string {
  return maskEmail(email);
}

async function assertLookupCooldown(
  key: string,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hecom_otp_rate_limits")
    .select("last_sent_at")
    .eq("email", key)
    .maybeSingle<{ last_sent_at: string }>();

  if (!data?.last_sent_at) return { ok: true };

  const elapsed = (Date.now() - Date.parse(data.last_sent_at)) / 1000;
  if (elapsed < LOOKUP_COOLDOWN_SECONDS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil(LOOKUP_COOLDOWN_SECONDS - elapsed),
    };
  }
  return { ok: true };
}

async function markLookup(key: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hecom_otp_rate_limits")
    .select("send_count")
    .eq("email", key)
    .maybeSingle<{ send_count: number }>();

  await admin.from("hecom_otp_rate_limits").upsert(
    {
      email: key,
      last_sent_at: new Date().toISOString(),
      send_count: (data?.send_count ?? 0) + 1,
    },
    { onConflict: "email" },
  );
}

/**
 * Login helper: nombre → posibles correos Hecom (para quien no recuerda el email).
 */
export async function POST(request: Request) {
  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = String(body.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LEN) {
    return NextResponse.json(
      {
        error: `Escribí al menos ${MIN_NAME_LEN} letras (mejor nombre y apellido).`,
      },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  const rateKey = `lookup:${ip}`;
  const rate = await assertLookupCooldown(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: `Esperá ${rate.retryAfterSec ?? LOOKUP_COOLDOWN_SECONDS}s antes de buscar de nuevo.`,
        retryAfterSec: rate.retryAfterSec,
      },
      { status: 429 },
    );
  }

  await markLookup(rateKey).catch(() => undefined);

  logHecomOtp("info", "email_lookup_start", {
    nameLen: name.length,
    ip: ip === "unknown" ? "unknown" : `${ip.slice(0, 8)}…`,
  });

  let clientes;
  try {
    clientes = await findHecomClientesByName(name);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo buscar en Hecom.";
    logHecomOtp("error", "email_lookup_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 503 });
  }

  type Match = {
    name: string;
    email: string;
    emailMasked: string;
  };

  const matches: Match[] = [];
  const seen = new Set<string>();

  for (const cliente of clientes) {
    for (const raw of cliente.emails) {
      const email = normalizeHecomOtpEmail(raw);
      if (!email.includes("@") || seen.has(email)) continue;
      seen.add(email);
      matches.push({
        name: cliente.name,
        email,
        emailMasked: maskEmailDisplay(email),
      });
      if (matches.length >= 6) break;
    }
    if (matches.length >= 6) break;
  }

  logHecomOtp("info", "email_lookup_ok", {
    nameLen: name.length,
    matchCount: matches.length,
  });

  if (matches.length === 0) {
    return NextResponse.json({
      ok: true,
      matches: [],
      message:
        "No encontramos ese nombre con correo en Hecom. Probá nombre y apellido, o escribí el correo si lo recordás.",
    });
  }

  return NextResponse.json({
    ok: true,
    matches,
    message:
      matches.length === 1
        ? "Encontramos este correo. Tocá para usarlo e iniciar sesión."
        : "Encontramos varias coincidencias. Elegí la tuya.",
  });
}
