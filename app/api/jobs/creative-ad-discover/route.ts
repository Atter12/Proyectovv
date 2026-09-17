import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { discoverRejectedAdsForOrganization } from "@/lib/creatives/discover-tiktok-ads.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function runDiscover(input?: {
  organizationId?: string;
  advertiserIds?: string[];
}) {
  const admin = createAdminClient();

  if (input?.organizationId && input.advertiserIds?.length) {
    return discoverRejectedAdsForOrganization({
      organizationId: input.organizationId,
      advertiserIds: input.advertiserIds,
    });
  }

  // Cron global: advertisers TikTok activos con hecom_cliente_id (top orgs).
  const { data: accounts } = await admin
    .from("ad_accounts")
    .select("organization_id, external_account_id")
    .eq("platform", "tiktok")
    .eq("status", "active")
    .not("external_account_id", "is", null)
    .not("metadata->>hecom_cliente_id", "is", null)
    .limit(120);

  const byOrg = new Map<string, string[]>();
  for (const row of accounts ?? []) {
    const org = String(row.organization_id ?? "").trim();
    const adv = String(row.external_account_id ?? "").trim();
    if (!org || !adv) continue;
    const list = byOrg.get(org) ?? [];
    if (!list.includes(adv)) list.push(adv);
    byOrg.set(org, list);
  }

  let listed = 0;
  let upserted = 0;
  let rejected = 0;
  const errors: string[] = [];
  for (const [organizationId, advertiserIds] of byOrg) {
    try {
      const result = await discoverRejectedAdsForOrganization({
        organizationId,
        advertiserIds: advertiserIds.slice(0, 25),
      });
      listed += result.listed;
      upserted += result.upserted;
      rejected += result.rejected;
      errors.push(...result.errors.slice(0, 5));
    } catch (error) {
      errors.push(
        `${organizationId}: ${error instanceof Error ? error.message : "error"}`,
      );
    }
  }

  return {
    advertisers: [...byOrg.values()].reduce((n, a) => n + a.length, 0),
    listed,
    upserted,
    rejected,
    errors,
  };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDiscover();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "discover failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const isCron = authorizeCron(request);
  const session = isCron ? null : await getSession();
  if (!isCron) {
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (!hasPermission(session.permissions, "creativeAnalyzer:read")) {
      return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
    }
    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organización no disponible." },
        { status: 400 },
      );
    }
  }

  let body: { advertiserIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (session?.organizationId) {
      const advertiserIds = Array.isArray(body.advertiserIds)
        ? body.advertiserIds.map(String)
        : [];
      let ids = advertiserIds.filter(Boolean);
      if (ids.length === 0) {
        const admin = createAdminClient();
        const { data: accounts } = await admin
          .from("ad_accounts")
          .select("external_account_id")
          .eq("organization_id", session.organizationId)
          .eq("platform", "tiktok")
          .eq("status", "active")
          .not("external_account_id", "is", null)
          .limit(40);
        ids = (accounts ?? [])
          .map((r) => String(r.external_account_id ?? "").trim())
          .filter(Boolean);
      }
      const result = await discoverRejectedAdsForOrganization({
        organizationId: session.organizationId,
        advertiserIds: ids,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await runDiscover();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "discover failed",
      },
      { status: 500 },
    );
  }
}
