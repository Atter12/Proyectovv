import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findHecomClientesByEmail,
  type HecomCliente,
} from "@/lib/hecom/clientes.server";

const OTP_COOLDOWN_SECONDS = 60;
const GENERIC_OK =
  "Si tu correo está habilitado, te enviamos un código.";

export function isHecomOtpLoginEnabled(): boolean {
  return serverEnv.authHecomOtpLogin;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createAnonAuthClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
    clientes = await findHecomClientesByEmail(email);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo validar Hecom.";
    return { ok: false, error: message, status: 503 };
  }

  // Correos de prueba (dev/piloto) sin tocar Hecom CRM.
  if (
    clientes.length === 0 &&
    serverEnv.authHecomOtpTestEmails.includes(email)
  ) {
    clientes = [
      {
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
      },
    ];
  }

  if (clientes.length === 0) {
    // Misma respuesta: no filtrar existencia de email.
    return {
      ok: true,
      message: GENERIC_OK,
      allowed: false,
      clienteIds: [],
    };
  }

  const auth = createAnonAuthClient();
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        hecom_otp: true,
        hecom_cliente_ids: clientes.map((item) => item.id),
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message, status: 502 };
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
}): Promise<{ clienteIds: string[] }> {
  const email = normalizeEmail(input.email);
  let clientes = await findHecomClientesByEmail(email);

  if (
    clientes.length === 0 &&
    serverEnv.authHecomOtpTestEmails.includes(email)
  ) {
    clientes = [
      {
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
      },
    ];
  }

  if (clientes.length === 0) return { clienteIds: [] };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  for (const cliente of clientes) {
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

  return { clienteIds: clientes.map((item) => item.id) };
}
