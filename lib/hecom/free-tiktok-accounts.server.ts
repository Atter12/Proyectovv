import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBcAdvertiserForCliente } from "@/lib/integrations/tiktok/bc-advertiser-create.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { getTikTokBcCreateProfile } from "@/lib/integrations/tiktok/bc-create-profiles";
import {
  assignAccess,
  listFreeTikTokAccounts,
  setSharedBudgetZero,
  tiktokGet,
} from "@/lib/hecom/staff-create-tiktok-accounts.server";

/**
 * Sección «Cuentas libres» (solo gerencia): crear cuentas de reserva en tandas,
 * verlas y entregarlas a un miembro del equipo o a un cliente.
 * Una cuenta es libre si su nombre lleva "libre" y no está vinculada a nadie en Hecom.
 * TikTok no deja renombrar por API (devuelve OK y no cambia): el nombre se pone al crear.
 */

/** Por tanda. TikTok marcó "unusual activity" al BM300 el 12/09 tras muchas altas seguidas. */
export const FREE_CREATE_MAX_PER_BATCH = 20;
export const FREE_CREATE_RECOMMENDED_PER_DAY = 20;
const AUDIT_CREATE = "tiktok.free_accounts_create";

export type FreeAccountMember = { userId: string; userName: string };
export type FreeAccountRow = { advertiserId: string; name: string; members: FreeAccountMember[] | null };
export type BcMember = { userId: string; userName: string; email: string | null; role: string | null };

function bmProfile(bmBucket: string) {
  const profile = getTikTokBcCreateProfile(bmBucket);
  if (profile.bmBucket !== bmBucket) throw new Error("BM inválido.");
  return profile;
}

/** "Freddy" → "Libre Freddy"; sin apodo → "Libre". Solo letras, números y espacios. */
export function freeNamePrefix(label: string | null | undefined): string {
  const clean = String(label ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\blibre\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean ? `Libre ${clean}` : "Libre";
}

/** Siguiente número para ese prefijo ("Libre Freddy 7" → 8), mirando las libres que ya hay. */
export function nextFreeSerial(names: string[], prefix: string): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`, "i");
  let max = 0;
  for (const n of names) {
    const m = re.exec(n.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** Libres del BM con quién tiene acceso a cada una (null si TikTok no respondió). */
export async function listFreeAccountsWithMembers(bmBucket: string): Promise<FreeAccountRow[]> {
  const profile = bmProfile(bmBucket);
  const free = await listFreeTikTokAccounts(profile.bmBucket);
  const { token } = await resolveTikTokFinanceAccessToken();
  return mapLimit(free, 5, async (f) => {
    try {
      const j = await tiktokGet(
        `/bc/asset/member/get/?bc_id=${profile.bcId}&asset_type=ADVERTISER&asset_id=${f.advertiserId}&page=1&page_size=20`,
        token,
      );
      if (j.code !== 0) return { ...f, members: null };
      const list = (j.data as { list?: Array<Record<string, unknown>> } | undefined)?.list ?? [];
      return {
        ...f,
        members: list
          .map((m) => ({ userId: String(m.user_id ?? ""), userName: String(m.user_name ?? m.user_id ?? "") }))
          .filter((m) => m.userId),
      };
    } catch {
      return { ...f, members: null };
    }
  });
}

/**
 * Equipo visto en las cuentas libres (ahí solo entra gente de Holistic).
 * El token no tiene permiso de /bc/member/get/, así que es la lista que hay; un miembro nuevo se pega por ID.
 */
export function teamFromFreeAccounts(accounts: FreeAccountRow[]): BcMember[] {
  const seen = new Map<string, BcMember>();
  for (const a of accounts) for (const m of a.members ?? []) {
    if (!seen.has(m.userId)) seen.set(m.userId, { userId: m.userId, userName: m.userName, email: null, role: null });
  }
  return [...seen.values()].sort((a, b) => a.userName.localeCompare(b.userName));
}

/** Miembros (usuarios) del Business Center, para darles una cuenta libre. */
export async function listBcMembers(bmBucket: string): Promise<BcMember[]> {
  const profile = bmProfile(bmBucket);
  const { token } = await resolveTikTokFinanceAccessToken();
  const members: BcMember[] = [];
  for (let page = 1; page <= 10; page++) {
    const j = await tiktokGet(`/bc/member/get/?bc_id=${profile.bcId}&page=${page}&page_size=50`, token);
    if (j.code !== 0) throw new Error(`TikTok no devolvió los miembros del BM${bmBucket}: ${String(j.message ?? "")}`);
    const data = j.data as { list?: Array<Record<string, unknown>>; page_info?: { total_number?: number } } | undefined;
    for (const m of data?.list ?? []) {
      const userId = String(m.user_id ?? "");
      if (!userId) continue;
      members.push({
        userId,
        userName: String(m.user_name ?? userId),
        email: m.user_email ? String(m.user_email) : null,
        role: m.user_role ? String(m.user_role) : null,
      });
    }
    if (page * 50 >= (data?.page_info?.total_number ?? 0)) break;
  }
  return members.sort((a, b) => a.userName.localeCompare(b.userName));
}

function limaDayStartIso(): string {
  const now = new Date();
  const lima = new Date(now.getTime() - 5 * 3600_000);
  const start = Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()) + 5 * 3600_000;
  return new Date(start).toISOString();
}

/** Cuentas libres creadas hoy (hora Lima) en ese BM desde esta sección. */
export async function countFreeCreatedToday(bmBucket: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("audit_logs")
    .select("metadata")
    .eq("action", AUDIT_CREATE)
    .gte("created_at", limaDayStartIso());
  let total = 0;
  for (const row of (data ?? []) as Array<{ metadata: Record<string, unknown> | null }>) {
    if (String(row.metadata?.bm ?? "") !== bmBucket) continue;
    total += Number(row.metadata?.created_count ?? 0) || 0;
  }
  return total;
}

export type FreeCreated = { advertiserId: string; name: string; budgetZero: boolean | null };

/** Crea de 1 a 20 cuentas libres "Libre <apodo> N". Lo ya creado queda aunque TikTok corte a la mitad. */
export async function createFreeTikTokAccounts(input: {
  bmBucket: string;
  count: number;
  label?: string | null;
  actorEmail: string;
}): Promise<{ created: FreeCreated[]; error: string | null }> {
  const profile = bmProfile(input.bmBucket);
  const count = Math.trunc(input.count);
  if (!(count >= 1 && count <= FREE_CREATE_MAX_PER_BATCH)) {
    throw new Error(`Puedes crear de 1 a ${FREE_CREATE_MAX_PER_BATCH} cuentas por tanda.`);
  }
  const prefix = freeNamePrefix(input.label);
  const existing = await listFreeTikTokAccounts(profile.bmBucket);
  const start = nextFreeSerial(existing.map((f) => f.name), prefix);
  const { token } = await resolveTikTokFinanceAccessToken();

  const created: FreeCreated[] = [];
  let error: string | null = null;
  for (let i = 0; i < count; i++) {
    try {
      const acc = await createBcAdvertiserForCliente({
        clienteName: prefix,
        bmBucket: profile.bmBucket,
        advertiserName: `${prefix} ${start + i}`,
      });
      // BM10/30 comparten crédito: la libre nace sin cupo.
      const budgetZero = profile.fundingMode === "shared_budget" ? await setSharedBudgetZero(acc.bcId, acc.advertiserId, token) : null;
      created.push({ advertiserId: acc.advertiserId, name: acc.advertiserName, budgetZero });
    } catch (e) {
      const message = e instanceof Error ? e.message : "TikTok no creó la cuenta.";
      error = created.length ? `Se crearon ${created.length} de ${count}. ${message}` : message;
      break;
    }
  }

  await createAdminClient()
    .from("audit_logs")
    .insert({
      action: AUDIT_CREATE,
      entity_type: "ad_accounts",
      metadata: { by: input.actorEmail, bm: profile.bmBucket, prefix, requested: count, created_count: created.length, created, error },
    })
    .then(() => undefined, () => undefined);
  return { created, error };
}

/** Da a un miembro del BC acceso ADMIN solo a esas cuentas libres (siguen libres, sin cliente). */
export async function assignFreeAccountsToMember(input: {
  bmBucket: string;
  advertiserIds: string[];
  userId: string;
  actorEmail: string;
}): Promise<Array<{ advertiserId: string; ok: boolean; message: string }>> {
  const profile = bmProfile(input.bmBucket);
  const userId = input.userId.trim();
  if (!/^\d{6,25}$/.test(userId)) throw new Error("Miembro inválido.");
  const ids = [...new Set(input.advertiserIds.map(String))];
  if (!ids.length || ids.length > FREE_CREATE_MAX_PER_BATCH) throw new Error(`Elige de 1 a ${FREE_CREATE_MAX_PER_BATCH} cuentas.`);
  const freeIds = new Set((await listFreeTikTokAccounts(profile.bmBucket)).map((f) => f.advertiserId));
  const notFree = ids.filter((id) => !freeIds.has(id));
  if (notFree.length) throw new Error(`Ya no están libres: ${notFree.join(", ")}.`);

  const { token } = await resolveTikTokFinanceAccessToken();
  const results: Array<{ advertiserId: string; ok: boolean; message: string }> = [];
  for (const advertiserId of ids) {
    const r = await assignAccess(profile.bcId, advertiserId, userId, token).catch((e) => ({
      userId,
      ok: false,
      message: e instanceof Error ? e.message : "error",
    }));
    results.push({ advertiserId, ok: r.ok, message: r.message });
  }
  await createAdminClient()
    .from("audit_logs")
    .insert({
      action: "tiktok.free_accounts_assign_member",
      entity_type: "ad_accounts",
      metadata: { by: input.actorEmail, bm: profile.bmBucket, user_id: userId, results },
    })
    .then(() => undefined, () => undefined);
  return results;
}
