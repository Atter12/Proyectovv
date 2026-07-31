import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendHecomOtpEmail } from "@/lib/email/auth-otp.server";
import { setSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  findHecomClientesByEmail,
  type HecomCliente,
} from "@/lib/hecom/clientes.server";

const OTP_COOLDOWN_SECONDS = 60;
const GENERIC_OK =
  "Si tu correo está habilitado, te enviamos un código y un enlace mágico.";

/** Gerentes Holistic (Hecom Club) — fallback si falta el env en Vercel. */
const DEFAULT_STAFF_EMAILS = [
  "anniealejandrova6@gmail.com",
  "gian.rojas.arcos@gmail.com",
  "victor.minas@unmsm.edu.pe",
  "attermayerbasiliorengifo@gmail.com",
  "branlyn.lopez.r@gmail.com",
  "freddyjgt258@gmail.com",
  "sebasnodeal@gmail.com",
];

export function isHecomOtpLoginEnabled(): boolean {
  return serverEnv.authHecomOtpLogin;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isHecomOtpStaffEmail(emailRaw: string): boolean {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;
  if (serverEnv.authHecomOtpStaffEmails.includes(email)) return true;
  if (serverEnv.adminAllowedEmails.includes(email)) return true;
  return DEFAULT_STAFF_EMAILS.includes(email);
}

function buildTestCliente(email: string): HecomCliente {
  return {
    id: `otp-test:${email}`,
    name: "Cliente prueba OTP",
    dni: null,
    emails: [email],
    phones: [],
    biz: "OTP test",
    notes: "Allowlist AUTH_HECOM_OTP_TEST_EMAILS",
    ig: null,
    avatarUrl: null,
    createdAt: null,
    tiktokAdvertiserId: null,
    tiktokAdvertiserName: null,
    tiktokSyncEnabled: null,
    tiktokDefaultFee: null,
    tiktokAccounts: [],
  };
}

/** Clientes Hecom permitidos para este correo (CRM + allowlist de prueba). */
export async function resolveHecomClientesForEmail(
  emailRaw: string,
): Promise<HecomCliente[]> {
  const email = normalizeEmail(emailRaw);
  let clientes = await findHecomClientesByEmail(email);
  if (
    clientes.length === 0 &&
    serverEnv.authHecomOtpTestEmails.includes(email)
  ) {
    clientes = [buildTestCliente(email)];
  }
  return clientes;
}

export function userMayAccessHecomCliente(input: {
  isAdmin: boolean;
  isStaff?: boolean;
  linkedClienteIds: string[];
  clienteId: string;
}): boolean {
  if (input.isAdmin || input.isStaff) return true;
  if (!isHecomOtpLoginEnabled()) return true;
  return input.linkedClienteIds.includes(input.clienteId);
}

async function assertOtpCooldown(email: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hecom_otp_rate_limits")
    .select("last_sent_at, send_count")
    .eq("email", email)
    .maybeSingle<{ last_sent_at: string; send_count: number }>();

  if (!data?.last_sent_at) return { ok: true };

  const elapsed = (Date.now() - Date.parse(data.last_sent_at)) / 1000;
  if (elapsed < OTP_COOLDOWN_SECONDS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil(OTP_COOLDOWN_SECONDS - elapsed),
    };
  }
  return { ok: true };
}

async function markOtpSent(email: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hecom_otp_rate_limits")
    .select("send_count")
    .eq("email", email)
    .maybeSingle<{ send_count: number }>();

  await admin.from("hecom_otp_rate_limits").upsert(
    {
      email,
      last_sent_at: new Date().toISOString(),
      send_count: (data?.send_count ?? 0) + 1,
    },
    { onConflict: "email" },
  );
}

export async function requestHecomClientOtp(input: {
  email: string;
}): Promise<{
  ok: true;
  message: string;
  allowed: boolean;
  clienteIds: string[];
  retryAfterSec?: number;
} | { ok: false; error: string; status: number }> {
  if (!isHecomOtpLoginEnabled()) {
    return { ok: false, error: "OTP Hecom deshabilitado.", status: 403 };
  }

  const email = normalizeEmail(input.email);
  if (!email.includes("@")) {
    return { ok: false, error: "Correo inválido.", status: 400 };
  }

  const rate = await assertOtpCooldown(email);
  if (!rate.ok) {
    return {
      ok: true,
      message: GENERIC_OK,
      allowed: false,
      clienteIds: [],
      retryAfterSec: rate.retryAfterSec,
    };
  }

  let clientes: HecomCliente[] = [];
  try {
    clientes = await resolveHecomClientesForEmail(email);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo validar Hecom.";
    return { ok: false, error: message, status: 503 };
  }

  const isStaff = isHecomOtpStaffEmail(email);

  if (clientes.length === 0 && !isStaff) {
    // Misma respuesta: no filtrar existencia de email.
    return {
      ok: true,
      message: GENERIC_OK,
      allowed: false,
      clienteIds: [],
    };
  }

  if (serverEnv.emailProvider !== "resend" || !serverEnv.resendApiKey) {
    return {
      ok: false,
      error:
        "Email no configurado. En Vercel: RESEND_API_KEY + RESEND_FROM (o EMAIL_FROM).",
      status: 503,
    };
  }

  const redirectTo = new URL("/auth/callback", serverEnv.appUrl);
  redirectTo.searchParams.set("flow", "hecom");

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: redirectTo.toString(),
      data: {
        hecom_otp: true,
        hecom_staff: isStaff,
        hecom_cliente_ids: clientes.map((item) => item.id),
      },
    },
  });

  if (linkError || !linkData) {
    return {
      ok: false,
      error: linkError?.message ?? "No se pudo generar el acceso.",
      status: 502,
    };
  }

  const code = linkData.properties?.email_otp;
  let magicLink = linkData.properties?.action_link;
  if (!code || !magicLink) {
    return {
      ok: false,
      error: "Supabase no devolvió código/enlace. Revisá Auth settings.",
      status: 502,
    };
  }

  // Forzar redirect a nuestra app (evita Site URL viejo tipo web-base-nu).
  try {
    const linkUrl = new URL(magicLink);
    linkUrl.searchParams.set("redirect_to", redirectTo.toString());
    magicLink = linkUrl.toString();
  } catch {
    // dejar action_link original
  }

  try {
    const sent = await sendHecomOtpEmail({ to: email, code, magicLink });
    if (!sent.sent) {
      return {
        ok: false,
        error: "Resend no envió el correo. Revisá RESEND_API_KEY y RESEND_FROM.",
        status: 502,
      };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error enviando con Resend.";
    return { ok: false, error: message, status: 502 };
  }

  await markOtpSent(email).catch(() => undefined);

  return {
    ok: true,
    message: GENERIC_OK,
    allowed: true,
    clienteIds: clientes.map((item) => item.id),
  };
}

export async function linkHecomClientesForUser(input: {
  userId: string;
  email: string;
}): Promise<{ clientes: Array<{ id: string; name: string }>; clienteIds: string[] }> {
  const email = normalizeEmail(input.email);
  const clientes = await resolveHecomClientesForEmail(email);

  if (clientes.length === 0) return { clientes: [], clienteIds: [] };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const mapped = clientes.map((item) => ({ id: item.id, name: item.name }));

  for (const cliente of mapped) {
    await admin.from("hecom_cliente_user_links").upsert(
      {
        user_id: input.userId,
        hecom_cliente_id: cliente.id,
        email,
        updated_at: now,
      },
      { onConflict: "user_id,hecom_cliente_id" },
    );
  }

  return { clientes: mapped, clienteIds: mapped.map((item) => item.id) };
}

/**
 * Tras OTP (código o magic link):
 * - staff/gerente → /clientes (lista completa, como ops)
 * - 1 cliente → cookie de scope automática (solo ve sus datos)
 * - N clientes → /clientes (lista filtrada)
 */
export async function provisionHecomClienteAccess(input: {
  userId: string;
  email: string;
}): Promise<{
  clientes: Array<{ id: string; name: string }>;
  clienteIds: string[];
  autoSelected: { id: string; name: string } | null;
  needsPicker: boolean;
  isStaff: boolean;
  nextPath: "/overview" | "/clientes";
}> {
  const email = normalizeEmail(input.email);
  const isStaff = isHecomOtpStaffEmail(email);

  if (isStaff) {
    return {
      clientes: [],
      clienteIds: [],
      autoSelected: null,
      needsPicker: true,
      isStaff: true,
      nextPath: "/clientes",
    };
  }

  const linked = await linkHecomClientesForUser(input);

  if (linked.clientes.length === 1) {
    const only = linked.clientes[0];
    await setSelectedHecomCliente({ id: only.id, name: only.name });
    return {
      ...linked,
      autoSelected: only,
      needsPicker: false,
      isStaff: false,
      nextPath: "/overview",
    };
  }

  if (linked.clientes.length > 1) {
    return {
      ...linked,
      autoSelected: null,
      needsPicker: true,
      isStaff: false,
      nextPath: "/clientes",
    };
  }

  return {
    ...linked,
    autoSelected: null,
    needsPicker: false,
    isStaff: false,
    nextPath: "/overview",
  };
}
