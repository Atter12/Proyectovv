import "server-only";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { linkTikTokCuentaToHecomCliente } from "@/lib/hecom/link-tiktok-cuenta.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { createBcAdvertiserForCliente } from "@/lib/integrations/tiktok/bc-advertiser-create.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  getTikTokBcCreateProfile,
  type TikTokCreateBmBucket,
} from "@/lib/integrations/tiktok/bc-create-profiles";
import { ensureAdvertisersInOrganizationForAllocation } from "@/services/payments.service";

/**
 * Gerencia crea cuentas TikTok para un cliente en cualquier BM, sin el límite
 * self-serve, y le da acceso a su usuario de TikTok (ADMIN solo de esa cuenta,
 * nunca del BM). Quedan vinculadas en Hecom y en el panel del cliente desde el
 * primer momento (antes se creaban a mano en TikTok y el cliente no las veía).
 */

export const STAFF_CREATE_MAX_PER_REQUEST = 5;
const API = "https://business-api.tiktok.com/open_api/v1.3";

export type ClienteTikTokUser = {
  userId: string;
  userName: string;
  /** En cuántas cuentas del cliente tiene acceso. */
  accounts: number;
  /** El nombre se parece al del cliente: se marca por defecto. */
  suggested: boolean;
};

export type StaffCreatedAccount = {
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  hecomLinked: boolean;
  inPanel: boolean;
  /** Solo BM10/30: presupuesto en $0 al nacer (null = no aplica). */
  budgetZero: boolean | null;
  access: Array<{ userId: string; ok: boolean; message: string }>;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tiktokGet(path: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, { headers: { "Access-Token": token }, cache: "no-store" });
  // IDs grandes como string exacto (Number pierde precisión).
  return JSON.parse(await res.text(), (k, v, ctx?: { source?: string }) =>
    typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
  ) as Record<string, unknown>;
}

async function clienteLinks(clienteId: string) {
  const { data, error } = await createHecomAdminClient()
    .from("cliente_tiktok_cuentas")
    .select("advertiser_id,advertiser_name,bm_bucket")
    .eq("client_id", clienteId);
  if (error) throw new Error("No se pudo leer las cuentas del cliente en Hecom.");
  return (data ?? []) as Array<{ advertiser_id: string; advertiser_name: string | null; bm_bucket: string | null }>;
}

/** Usuarios de TikTok con acceso a las cuentas que el cliente ya tiene (para darle acceso a las nuevas). */
export async function detectClienteTikTokUsers(clienteId: string): Promise<ClienteTikTokUser[]> {
  const cliente = await getHecomCliente(clienteId);
  if (!cliente) throw new Error("Cliente no encontrado.");
  const links = (await clienteLinks(clienteId)).filter((l) => l.bm_bucket && HECOM_BM_BUCKET_TO_BC[l.bm_bucket]);
  const { token } = await resolveTikTokFinanceAccessToken();
  const users = new Map<string, ClienteTikTokUser>();
  // Las más nuevas primero: ahí está el usuario actual del cliente.
  for (const l of links.sort((a, b) => b.advertiser_id.localeCompare(a.advertiser_id)).slice(0, 8)) {
    const j = await tiktokGet(
      `/bc/asset/member/get/?bc_id=${HECOM_BM_BUCKET_TO_BC[l.bm_bucket!]}&asset_type=ADVERTISER&asset_id=${l.advertiser_id}&page=1&page_size=20`,
      token,
    );
    const list = ((j.data as { list?: Array<Record<string, unknown>> } | undefined)?.list ?? []);
    for (const m of list) {
      const userId = String(m.user_id ?? "");
      if (!userId) continue;
      const prev = users.get(userId);
      users.set(userId, {
        userId,
        userName: String(m.user_name ?? userId),
        accounts: (prev?.accounts ?? 0) + 1,
        suggested: false,
      });
    }
  }
  const firstWord = norm(cliente.name).split(" ")[0] ?? "";
  return [...users.values()]
    .map((u) => ({ ...u, suggested: firstWord.length >= 3 && norm(u.userName).split(" ").includes(firstWord) }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || b.accounts - a.accounts);
}

/** Siguiente serial libre del cliente en ese BM (por nombre: 300, 301…), no por cantidad: hay huecos. */
export function nextSerialOffset(
  links: Array<{ advertiser_name: string | null; bm_bucket: string | null }>,
  bmBucket: TikTokCreateBmBucket,
): number {
  const base = getTikTokBcCreateProfile(bmBucket).nameSerialBase;
  const inBm = links.filter((l) => l.bm_bucket === bmBucket);
  let max = -1;
  for (const l of inBm) {
    for (const m of String(l.advertiser_name ?? "").matchAll(/(\d+)(?:[.,]\d+)?/g)) {
      const n = Number(m[1]);
      if (n >= base && n < base + 100) max = Math.max(max, n - base);
    }
  }
  return Math.max(max + 1, inBm.length);
}

async function setSharedBudgetZero(bcId: string, advertiserId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/advertiser/update/`, {
      method: "POST",
      headers: { "Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        bc_id: bcId,
        budget_update_type: "UPDATE",
        advertiser_budgets: [{ advertiser_id: advertiserId, budget: 0, budget_mode: "CUSTOM_BUDGET" }],
      }),
      cache: "no-store",
    });
    const j = (await res.json()) as { code?: number; data?: { advertiser_budgets?: Array<{ status?: string }> } };
    return j.code === 0 && !j.data?.advertiser_budgets?.some((b) => b.status === "FAILED");
  } catch {
    return false;
  }
}

async function assignAccess(bcId: string, advertiserId: string, userId: string, token: string) {
  const res = await fetch(`${API}/bc/asset/assign/`, {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ bc_id: bcId, user_id: userId, asset_type: "ADVERTISER", asset_id: advertiserId, advertiser_role: "ADMIN" }),
    cache: "no-store",
  });
  const j = (await res.json()) as { code?: number; message?: string };
  return { userId, ok: j.code === 0, message: j.code === 0 ? "OK" : String(j.message ?? `HTTP ${res.status}`) };
}

export async function staffCreateTikTokAccounts(input: {
  hecomClienteId: string;
  bmBucket: string;
  count: number;
  accessUserIds: string[];
  actorUserId: string | null;
}): Promise<{ created: StaffCreatedAccount[]; error: string | null }> {
  const cliente = await getHecomCliente(input.hecomClienteId);
  if (!cliente) throw new Error("Cliente no encontrado.");
  const profile = getTikTokBcCreateProfile(input.bmBucket);
  if (profile.bmBucket !== input.bmBucket) throw new Error("BM inválido.");
  const count = Math.trunc(input.count);
  if (!(count >= 1 && count <= STAFF_CREATE_MAX_PER_REQUEST)) {
    throw new Error(`Puedes crear de 1 a ${STAFF_CREATE_MAX_PER_REQUEST} cuentas por vez.`);
  }
  const userIds = [...new Set(input.accessUserIds.map((u) => u.trim()).filter((u) => /^\d{6,25}$/.test(u)))];

  const organizationId = await resolveOrganizationIdForHecomCliente(cliente.id);
  const { token } = await resolveTikTokFinanceAccessToken(organizationId ?? undefined);
  const offset = nextSerialOffset(await clienteLinks(cliente.id), profile.bmBucket);

  const created: StaffCreatedAccount[] = [];
  for (let i = 0; i < count; i++) {
    let acc: Awaited<ReturnType<typeof createBcAdvertiserForCliente>>;
    try {
      acc = await createBcAdvertiserForCliente({
        clienteName: cliente.name,
        bmBucket: profile.bmBucket,
        organizationId: organizationId ?? undefined,
        existingInBm: offset + i,
      });
    } catch (error) {
      // Lo ya creado queda; se informa dónde cortó.
      const message = error instanceof Error ? error.message : "TikTok no creó la cuenta.";
      return { created, error: created.length ? `Se crearon ${created.length} de ${count}. ${message}` : message };
    }

    const row: StaffCreatedAccount = {
      advertiserId: acc.advertiserId,
      advertiserName: acc.advertiserName,
      bmBucket: acc.bmBucket,
      hecomLinked: false,
      inPanel: false,
      budgetZero: null,
      access: [],
    };
    // BM10/30 comparten crédito: la cuenta nace sin cupo y se le da al pagar.
    if (profile.fundingMode === "shared_budget") {
      row.budgetZero = await setSharedBudgetZero(acc.bcId, acc.advertiserId, token);
    }
    try {
      await linkTikTokCuentaToHecomCliente({
        clientId: cliente.id,
        advertiserId: acc.advertiserId,
        advertiserName: acc.advertiserName,
        bmBucket: acc.bmBucket,
        fee: cliente.tiktokDefaultFee,
      });
      row.hecomLinked = true;
    } catch (error) {
      console.error("[staff-create] hecom_link_failed", { advertiserId: acc.advertiserId, error: error instanceof Error ? error.message : error });
    }
    for (const userId of userIds) {
      row.access.push(await assignAccess(acc.bcId, acc.advertiserId, userId, token).catch((e) => ({
        userId,
        ok: false,
        message: e instanceof Error ? e.message : "error",
      })));
    }
    created.push(row);
  }

  if (organizationId) {
    try {
      await syncApprovedAdAccountsForCliente({ organizationId, clienteId: cliente.id, userId: input.actorUserId, forceRefresh: true });
      await ensureAdvertisersInOrganizationForAllocation({
        organizationId,
        clienteId: cliente.id,
        clienteName: cliente.name,
        userId: input.actorUserId,
        advertisers: created.map((c) => ({ advertiserId: c.advertiserId, name: c.advertiserName, status: "active" })),
      });
      for (const c of created) c.inPanel = true;
    } catch (error) {
      console.warn("[staff-create] panel_sync_partial", { error: error instanceof Error ? error.message : error });
    }
  }
  return { created, error: null };
}
