import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  importTikTokAdvertiserAccounts,
  syncTikTokAdvertiserSpend,
  type TikTokSpendSyncResult,
} from "@/lib/integrations/tiktok/client.server";

// Recorre todas las cuentas TikTok de clientes (una consulta de reporte por
// anunciante); con decenas de cuentas no cabe en el límite por defecto.
export const maxDuration = 300;

type AdminClient = ReturnType<typeof createAdminClient>;

type TikTokAdAccountRow = {
  id: string;
  organization_id: string;
  external_account_id: string | null;
  hecom_cliente_id: string | null;
  hecom_cliente_id_alt: string | null;
};

/** Cuenta a sincronizar: la fila canónica de un anunciante de cliente Hecom. */
type ClientSpendTarget = {
  hecomClienteId: string;
  organizationId: string;
  adAccountId: string;
  advertiserId: string;
};

type SkippedAdvertiser = {
  advertiserId: string;
  hecomClienteId: string | null;
  reason: string;
};

/** Anunciantes en paralelo: rápido sin pasar el límite de consultas de TikTok. */
const SPEND_SYNC_CONCURRENCY = 6;
/**
 * Pasado este tiempo no se empieza otro anunciante: los que faltan se devuelven
 * en `pendingAdvertiserIds` en vez de perder la corrida entera por el corte de
 * Vercel (300 s).
 */
const SPEND_SYNC_BUDGET_MS = 230_000;

/** Corre `worker` de a `concurrency`; devuelve los que no alcanzó a empezar. */
async function forEachConcurrently<T>(
  items: T[],
  concurrency: number,
  deadlineMs: number,
  worker: (item: T) => Promise<void>,
): Promise<T[]> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length && Date.now() < deadlineMs) await worker(items[next++]!);
  });
  await Promise.all(runners);
  return items.slice(next);
}

/**
 * Cada corrida empieza en otro punto de la lista para que, si alguna no
 * alcanza, no sean siempre los mismos anunciantes los que quedan fuera.
 */
function rotate<T>(items: T[]): T[] {
  if (items.length === 0) return items;
  const offset = Math.floor(Date.now() / (30 * 60 * 1000)) * 97 % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

function resolveDateRange(request: Request): { startDate: string; endDate: string } {
  const url = new URL(request.url);
  const todayLima = todayYmdInTz("America/Lima");
  const yesterdayLima = shiftYmd(todayLima, -1);
  const requestedStart = url.searchParams.get("start_date");
  const requestedEnd = url.searchParams.get("end_date");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  return {
    startDate:
      requestedStart && datePattern.test(requestedStart) ? requestedStart : yesterdayLima,
    endDate: requestedEnd && datePattern.test(requestedEnd) ? requestedEnd : todayLima,
  };
}

/** Lee todas las cuentas TikTok con anunciante (Supabase devuelve de a 1000). */
async function loadTikTokAdAccounts(admin: AdminClient): Promise<TikTokAdAccountRow[]> {
  const rows: TikTokAdAccountRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("ad_accounts")
      .select(
        "id, organization_id, external_account_id, hecom_cliente_id:metadata->>hecom_cliente_id, hecom_cliente_id_alt:metadata->>hecomClienteId",
      )
      .eq("platform", "tiktok")
      .not("external_account_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`ad_accounts: ${error.message}`);
    rows.push(...((data ?? []) as unknown as TikTokAdAccountRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/**
 * Anunciantes de clientes Ads Holistic → fila donde se registra el gasto.
 *
 * Un mismo anunciante puede tener varias filas (espejos que crea el staff al
 * "ver como" otra org). El gasto se registra una sola vez y solo en la fila de
 * la org del cliente (resolveOrganizationIdForHecomCliente), que es la que
 * recibe las asignaciones; registrarlo también en espejos lo duplicaría.
 */
async function resolveClientSpendTargets(
  admin: AdminClient,
  hecomClienteFilter: string,
): Promise<{
  targets: ClientSpendTarget[];
  skipped: SkippedAdvertiser[];
  advertiserIds: Set<string>;
}> {
  const rows = await loadTikTokAdAccounts(admin);
  const byAdvertiser = new Map<string, TikTokAdAccountRow[]>();
  for (const row of rows) {
    const advertiserId = String(row.external_account_id ?? "").trim();
    if (!advertiserId) continue;
    const list = byAdvertiser.get(advertiserId) ?? [];
    list.push(row);
    byAdvertiser.set(advertiserId, list);
  }

  const orgByCliente = new Map<string, string | null>();
  const targets: ClientSpendTarget[] = [];
  const skipped: SkippedAdvertiser[] = [];
  // Todos los anunciantes de clientes, incluso los omitidos: el camino OAuth no
  // debe tocarlos (sus filas en otras orgs son espejos).
  const advertiserIds = new Set<string>();

  for (const [advertiserId, list] of byAdvertiser) {
    const clienteIds = [
      ...new Set(
        list
          .map((row) => String(row.hecom_cliente_id ?? row.hecom_cliente_id_alt ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (clienteIds.length === 0) continue;
    advertiserIds.add(advertiserId);

    if (clienteIds.length > 1) {
      // Dos clientes reclamando la misma cuenta: no se adivina a quién cobrarle.
      skipped.push({
        advertiserId,
        hecomClienteId: null,
        reason: `varios clientes Hecom: ${clienteIds.join(", ")}`,
      });
      continue;
    }

    const hecomClienteId = clienteIds[0]!;
    if (hecomClienteFilter && hecomClienteId !== hecomClienteFilter) continue;

    if (!orgByCliente.has(hecomClienteId)) {
      orgByCliente.set(
        hecomClienteId,
        await resolveOrganizationIdForHecomCliente(hecomClienteId),
      );
    }
    const organizationId = orgByCliente.get(hecomClienteId) ?? null;
    if (!organizationId) {
      skipped.push({ advertiserId, hecomClienteId, reason: "sin org Holistic para el cliente" });
      continue;
    }

    const canonical = list
      .filter((row) => row.organization_id === organizationId)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!canonical) {
      skipped.push({
        advertiserId,
        hecomClienteId,
        reason: "la org del cliente no tiene fila para este anunciante",
      });
      continue;
    }

    targets.push({ hecomClienteId, organizationId, adAccountId: canonical.id, advertiserId });
  }

  return { targets, skipped, advertiserIds };
}

async function runSync(request: Request) {
  const deadlineMs = Date.now() + SPEND_SYNC_BUDGET_MS;
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { startDate, endDate } = resolveDateRange(request);
  if (startDate > endDate) {
    return NextResponse.json(
      { error: "start_date no puede ser posterior a end_date." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const hecomClienteId = (
    url.searchParams.get("hecom_cliente_id") ||
    url.searchParams.get("client_id") ||
    ""
  ).trim();
  // Para retomar una corrida cortada: solo estos anunciantes de clientes.
  const onlyAdvertiserIds = new Set(
    (url.searchParams.get("advertiser_ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  let pendingAdvertiserIds: string[] = [];

  const admin = createAdminClient();

  let organizationFilter: string | null = null;
  if (hecomClienteId) {
    organizationFilter = await resolveOrganizationIdForHecomCliente(hecomClienteId);
    if (!organizationFilter) {
      return NextResponse.json(
        { ok: false, error: "No hay org Holistic para ese hecom_cliente_id." },
        { status: 404 },
      );
    }
  }

  let imported = 0;
  let recordedCents = 0;
  let recordedDays = 0;
  let uncoveredCents = 0;
  const failures: Array<{ organizationId: string; advertiserId?: string; error: string }> = [];
  const spendResults: Array<
    { organizationId: string; source: "agency" | "oauth" } & Omit<
      TikTokSpendSyncResult,
      "uncovered" | "uncoveredCents"
    >
  > = [];
  const uncovered: Array<{
    organizationId: string;
    adAccountId: string;
    advertiserId: string;
    date: string;
    reportedCents: number;
    alreadyRecordedCents: number;
    recordedCents: number;
    uncoveredCents: number;
  }> = [];

  const collect = (
    organizationId: string,
    adAccountId: string,
    source: "agency" | "oauth",
    spend: TikTokSpendSyncResult,
  ) => {
    const { uncovered: spendUncovered, uncoveredCents: spendUncoveredCents, ...rest } = spend;
    recordedCents += spend.recordedCents;
    recordedDays += spend.recordedDays;
    uncoveredCents += spendUncoveredCents;
    spendResults.push({ organizationId, source, ...rest });
    for (const day of spendUncovered) {
      uncovered.push({ organizationId, adAccountId, advertiserId: spend.advertiserId, ...day });
    }
  };

  // 1) Cuentas de clientes Ads Holistic con el token de agencia. Casi ninguna
  // org de cliente tiene OAuth propio; si solo se recorrieran las conexiones,
  // el gasto no se registraría y el saldo asignado quedaría inflado (el tope
  // de presupuesto, el guardián de prepago y los reclamos lo leen).
  let clientAdvertiserIds = new Set<string>();
  let skipped: SkippedAdvertiser[] = [];
  try {
    const plan = await resolveClientSpendTargets(admin, hecomClienteId);
    clientAdvertiserIds = plan.advertiserIds;
    skipped = plan.skipped;

    // Uno por uno, ~320 anunciantes no entran en los 300 s de Vercel y los
    // últimos de la lista nunca se registraban. Cada anunciante escribe solo en
    // su propia fila, así que se procesan de a varios.
    const targets = onlyAdvertiserIds.size
      ? plan.targets.filter((target) => onlyAdvertiserIds.has(target.advertiserId))
      : rotate(plan.targets);
    const notStarted = await forEachConcurrently(targets, SPEND_SYNC_CONCURRENCY, deadlineMs, async (target) => {
      try {
        const { token } = await resolveTikTokFinanceAccessToken(target.organizationId);
        const spend = await syncTikTokAdvertiserSpend({
          organizationId: target.organizationId,
          adAccountId: target.adAccountId,
          advertiserId: target.advertiserId,
          startDate,
          endDate,
          accessToken: token,
        });
        collect(target.organizationId, target.adAccountId, "agency", spend);
      } catch (spendError) {
        failures.push({
          organizationId: target.organizationId,
          advertiserId: target.advertiserId,
          error: `Advertiser ${target.advertiserId}: ${
            spendError instanceof Error ? spendError.message : "Error desconocido"
          }`,
        });
      }
    });
    pendingAdvertiserIds = notStarted.map((target) => target.advertiserId);
    if (pendingAdvertiserIds.length) {
      console.warn("[tiktok-spend] sin tiempo para todos", { pending: pendingAdvertiserIds.length });
    }
  } catch (planError) {
    // Sin la lista de clientes no se sabe qué filas son espejos: el camino
    // OAuth se corta abajo para no registrar gasto en ellas.
    failures.push({
      organizationId: organizationFilter ?? "*",
      error: `Cuentas de clientes: ${
        planError instanceof Error ? planError.message : "Error desconocido"
      }`,
    });
    return NextResponse.json(
      {
        ok: false,
        range: { startDate, endDate, tz: "America/Lima" },
        hecom_cliente_id: hecomClienteId || null,
        organization_id: organizationFilter,
        failures,
      },
      { status: 500 },
    );
  }

  // 2) Orgs con TikTok conectado por OAuth (camino original). Se saltan los
  // anunciantes de clientes: ya los cubrió el paso 1 en su fila canónica y
  // aquí solo podrían ser espejos.
  let connectionsQuery = admin
    .from("integration_connections")
    .select("organization_id, created_by")
    .eq("provider", "tiktok")
    .eq("status", "active");
  if (organizationFilter) {
    connectionsQuery = connectionsQuery.eq("organization_id", organizationFilter);
  }

  const { data, error } = await connectionsQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Al retomar anunciantes de clientes, con skip_oauth (gasto atrasado) o sin
  // tiempo, el camino OAuth espera a la próxima corrida.
  const skipOauth = onlyAdvertiserIds.size > 0 || url.searchParams.get("skip_oauth") === "1";
  const connections = skipOauth ? [] : (data ?? []);
  for (const connection of connections) {
    if (Date.now() >= deadlineMs) break;
    try {
      const result = await importTikTokAdvertiserAccounts({
        organizationId: connection.organization_id,
        userId: connection.created_by ?? null,
      });
      imported += result.imported;

      const { data: adAccounts, error: adAccountsError } = await admin
        .from("ad_accounts")
        .select("id, external_account_id, metadata")
        .eq("organization_id", connection.organization_id)
        .eq("platform", "tiktok")
        .not("external_account_id", "is", null);
      if (adAccountsError) throw new Error(adAccountsError.message);

      const accounts = (adAccounts ?? []).filter((account) => {
        if (clientAdvertiserIds.has(String(account.external_account_id ?? "").trim())) {
          return false;
        }
        if (!hecomClienteId) return true;
        const meta = (account.metadata ?? {}) as Record<string, unknown>;
        const metaId = String(meta.hecom_cliente_id ?? meta.hecomClienteId ?? "").trim();
        return !metaId || metaId === hecomClienteId;
      });

      for (const account of accounts) {
        if (Date.now() >= deadlineMs) break;
        if (!account.external_account_id) continue;
        try {
          const spend = await syncTikTokAdvertiserSpend({
            organizationId: connection.organization_id,
            adAccountId: account.id,
            advertiserId: account.external_account_id,
            startDate,
            endDate,
          });
          collect(connection.organization_id, account.id, "oauth", spend);
        } catch (spendError) {
          failures.push({
            organizationId: connection.organization_id,
            error: `Advertiser ${account.external_account_id}: ${
              spendError instanceof Error ? spendError.message : "Error desconocido"
            }`,
          });
        }
      }
    } catch (syncError) {
      failures.push({
        organizationId: connection.organization_id,
        error: syncError instanceof Error ? syncError.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    range: { startDate, endDate, tz: "America/Lima" },
    hecom_cliente_id: hecomClienteId || null,
    organization_id: organizationFilter,
    imported,
    recordedDays,
    recordedCents,
    // Gasto real en TikTok sin saldo asignado detrás: pérdida de agencia a
    // revisar. Se recalcula en cada corrida para los días del rango.
    uncoveredCents,
    uncovered,
    // Anunciantes que no alcanzaron en esta corrida (ver SPEND_SYNC_BUDGET_MS).
    pendingAdvertiserIds,
    skipped,
    spendResults,
    failures,
  });
}

export async function GET(request: Request) {
  return runSync(request);
}

export async function POST(request: Request) {
  return runSync(request);
}
