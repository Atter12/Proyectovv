import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";
import {
  assignFreeAccountsToMember,
  countFreeCreatedToday,
  createFreeTikTokAccounts,
  FREE_CREATE_MAX_PER_BATCH,
  FREE_CREATE_RECOMMENDED_PER_DAY,
  listBcMembers,
  listFreeAccountsWithMembers,
  summarizeFreeByBm,
  teamFromFreeAccounts,
} from "@/lib/hecom/free-tiktok-accounts.server";
import {
  detectClienteTikTokUsers,
  readTikTokAdvertiserNames,
  renameTikTokAdvertiser,
  STAFF_CREATE_MAX_PER_REQUEST,
  staffGiveFreeTikTokAccounts,
} from "@/lib/hecom/staff-create-tiktok-accounts.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/records";

export const runtime = "nodejs";
// 20 altas seguidas en TikTok pueden pasar del minuto.
export const maxDuration = 300;

const BMS = new Set(["300", "200", "30", "10"]);

/** Solo gerencia de verdad (correo staff), nunca un cliente ni el modo tester. */
async function requireStaff() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const email = String(session.email ?? "");
  if (!isHecomOtpStaffEmail(email) && !isPaymentsSuperAdminEmail(email)) {
    return { error: NextResponse.json({ error: "Solo gerencia." }, { status: 403 }) };
  }
  return { session, email };
}

function fail(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Error." }, { status });
}

/**
 * GET ?bm=300 → cuentas libres (con quién tiene acceso), miembros del BC y cuántas se crearon hoy.
 * GET ?clienteId=… → usuarios de TikTok del cliente, para darles acceso al asignar.
 * GET ?summary=1 → por BM: libres, total de cuentas, cuántas crear hoy y si llegó al tope.
 * GET ?names=id1,id2 → nombre vivo en TikTok de cada cuenta (para ver si el renombre ya se aplicó).
 */
export async function GET(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  try {
    const clienteId = url.searchParams.get("clienteId");
    if (clienteId) return NextResponse.json({ users: await detectClienteTikTokUsers(clienteId) });
    if (url.searchParams.get("summary")) return NextResponse.json({ summary: await summarizeFreeByBm() });
    const names = url.searchParams.get("names");
    if (names) {
      const { token } = await resolveTikTokFinanceAccessToken();
      return NextResponse.json({ names: await readTikTokAdvertiserNames(names.split(","), token) });
    }
    const bm = String(url.searchParams.get("bm") ?? "300");
    if (!BMS.has(bm)) return fail(new Error("BM inválido."));
    const [accounts, bcMembers, createdToday] = await Promise.all([
      listFreeAccountsWithMembers(bm),
      listBcMembers(bm).catch(() => null),
      countFreeCreatedToday(bm),
    ]);
    const members = bcMembers?.length ? bcMembers : teamFromFreeAccounts(accounts);
    return NextResponse.json({
      bm,
      accounts,
      members,
      createdToday,
      maxPerBatch: FREE_CREATE_MAX_PER_BATCH,
      recommendedPerDay: FREE_CREATE_RECOMMENDED_PER_DAY,
      maxPerClienteAssign: STAFF_CREATE_MAX_PER_REQUEST,
    });
  } catch (error) {
    return fail(error, 500);
  }
}

/**
 * POST
 *  { action: "create", bm, count, label? }
 *  { action: "member", bm, advertiserIds[], userId }
 *  { action: "cliente", bm, advertiserIds[], clienteId, accessUserIds[] }
 *  { action: "rename", advertiserId, name }
 */
export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(new Error("JSON inválido."));
  }
  if (!isRecord(body)) return fail(new Error("JSON inválido."));
  if (body.action === "rename") {
    const advertiserId = String(body.advertiserId ?? "");
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!/^\d{6,25}$/.test(advertiserId)) return fail(new Error("Cuenta inválida."));
    if (!name || name.length > 100) return fail(new Error("Escribe un nombre de hasta 100 caracteres."));
    const { token } = await resolveTikTokFinanceAccessToken();
    const result = await renameTikTokAdvertiser(advertiserId, name, token);
    await createAdminClient()
      .from("audit_logs")
      .insert({ action: "tiktok.rename_advertiser", entity_type: "ad_accounts", metadata: { by: auth.email, advertiserId, name, ok: result.ok, message: result.message } })
      .then(() => undefined, () => undefined);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }
  const bm = String(body.bm ?? "");
  if (!BMS.has(bm)) return fail(new Error("BM inválido."));
  const ids = Array.isArray(body.advertiserIds) ? body.advertiserIds.map(String) : [];

  try {
    if (body.action === "create") {
      const result = await createFreeTikTokAccounts({
        bmBucket: bm,
        count: Number(body.count ?? 1),
        label: typeof body.label === "string" ? body.label : null,
        actorEmail: auth.email,
      });
      return NextResponse.json(result, { status: result.created.length || !result.error ? 200 : 502 });
    }
    if (body.action === "member") {
      const results = await assignFreeAccountsToMember({
        bmBucket: bm,
        advertiserIds: ids,
        userId: String(body.userId ?? ""),
        actorEmail: auth.email,
      });
      return NextResponse.json({ results });
    }
    if (body.action === "cliente") {
      const clienteId = String(body.clienteId ?? "");
      if (!clienteId) return fail(new Error("Elige un cliente."));
      const result = await staffGiveFreeTikTokAccounts({
        hecomClienteId: clienteId,
        bmBucket: bm,
        count: ids.length,
        advertiserIds: ids,
        accessUserIds: Array.isArray(body.accessUserIds) ? body.accessUserIds.map(String) : [],
        actorUserId: auth.session.id,
      });
      await createAdminClient()
        .from("audit_logs")
        .insert({
          action: "tiktok.staff_give_free_accounts",
          entity_type: "ad_accounts",
          metadata: { by: auth.email, hecom_cliente_id: clienteId, bm, from: "cuentas-libres", created: result.created, error: result.error },
        })
        .then(() => undefined, () => undefined);
      return NextResponse.json(result, { status: result.created.length || !result.error ? 200 : 502 });
    }
    return fail(new Error("Acción inválida."));
  } catch (error) {
    return fail(error);
  }
}
