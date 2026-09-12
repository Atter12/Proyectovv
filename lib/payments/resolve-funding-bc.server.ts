import {
  HECOM_BM_BUCKET_TO_BC,
  resolveBmBucketFromBcId,
} from "@/lib/hecom/bm-bucket.shared";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { resolveBcIdForHecomBucket } from "@/lib/integrations/tiktok/bc-advertisers.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { serverEnv } from "@/lib/env/env.server";

export type FundingBcResolution = {
  bcId: string;
  bmBucket: string | null;
  source:
    | "ad_account_bc_id"
    | "ad_account_bm_label"
    | "hecom"
    | "tiktok_probe"
    | "default";
};

function apiUrl(path: string): string {
  const base = "https://business-api.tiktok.com/open_api/v1.3";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Busca bm_bucket en Hecom (cliente_tiktok_cuentas) por advertiser. */
export async function lookupHecomBmBucketForAdvertiser(input: {
  advertiserId: string;
  hecomClienteId?: string | null;
}): Promise<string | null> {
  const advertiserId = input.advertiserId.trim();
  if (!advertiserId) return null;

  try {
    const hecom = createHecomAdminClient();
    let query = hecom
      .from("cliente_tiktok_cuentas")
      .select("bm_bucket,client_id,advertiser_id")
      .eq("advertiser_id", advertiserId)
      .limit(5);

    const clienteId = input.hecomClienteId?.trim();
    if (clienteId) {
      query = query.eq("client_id", clienteId);
    }

    const { data, error } = await query;
    if (error || !data?.length) {
      if (clienteId) {
        // Reintento sin filtro de cliente (misma cuenta en otro client_id).
        const retry = await hecom
          .from("cliente_tiktok_cuentas")
          .select("bm_bucket,client_id,advertiser_id")
          .eq("advertiser_id", advertiserId)
          .limit(5);
        if (retry.error || !retry.data?.length) return null;
        const bucket = String(retry.data[0]?.bm_bucket ?? "").trim();
        return bucket && HECOM_BM_BUCKET_TO_BC[bucket] ? bucket : null;
      }
      return null;
    }

    const bucket = String(data[0]?.bm_bucket ?? "").trim();
    return bucket && HECOM_BM_BUCKET_TO_BC[bucket] ? bucket : null;
  } catch {
    return null;
  }
}

/**
 * Si la fila no tiene BC, pregunta a TikTok en qué BM de agencia vive el advertiser.
 * Usa /bc/asset/get/ con keyword (rápido) sobre BM 10/30/200.
 */
export async function probeAgencyBcForAdvertiser(input: {
  advertiserId: string;
  organizationId?: string;
}): Promise<FundingBcResolution | null> {
  const advertiserId = input.advertiserId.trim();
  if (!advertiserId) return null;

  let accessToken: string;
  try {
    const resolved = await resolveTikTokFinanceAccessToken(input.organizationId);
    accessToken = resolved.token;
  } catch {
    return null;
  }

  for (const [bucket, bcId] of Object.entries(HECOM_BM_BUCKET_TO_BC)) {
    try {
      const url = new URL(apiUrl("/bc/asset/get/"));
      url.searchParams.set("bc_id", bcId);
      url.searchParams.set("asset_type", "ADVERTISER");
      url.searchParams.set(
        "filtering",
        JSON.stringify({ keyword: advertiserId }),
      );
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "10");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "Access-Token": accessToken },
        cache: "no-store",
      });
      const json = (await response.json()) as {
        code?: number;
        data?: { list?: Array<{ asset_id?: string | number }> };
      };
      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        continue;
      }
      const hit = (json.data?.list ?? []).some(
        (row) => String(row.asset_id ?? "") === advertiserId,
      );
      if (hit) {
        return { bcId, bmBucket: bucket, source: "tiktok_probe" };
      }
    } catch {
      // siguiente BM
    }
  }

  return null;
}

/**
 * Resuelve el BC real para Asignar/Recuperar.
 * Sin esto, cuentas con external_business_id null caen al BM default (cash)
 * y BM 10/30 fallan con el error de "no hay cash".
 */
export async function resolveFundingBcForAdvertiser(input: {
  rawBusinessId?: string | null;
  advertiserId: string;
  hecomClienteId?: string | null;
  organizationId?: string;
}): Promise<FundingBcResolution> {
  const raw = String(input.rawBusinessId ?? "").trim();
  const advertiserId = input.advertiserId.trim();

  const fromKnownBc = resolveBmBucketFromBcId(raw);
  if (fromKnownBc) {
    return { bcId: raw, bmBucket: fromKnownBc, source: "ad_account_bc_id" };
  }

  if (raw && HECOM_BM_BUCKET_TO_BC[raw]) {
    return {
      bcId: HECOM_BM_BUCKET_TO_BC[raw]!,
      bmBucket: raw,
      source: "ad_account_bm_label",
    };
  }

  if (advertiserId) {
    const hecomBucket = await lookupHecomBmBucketForAdvertiser({
      advertiserId,
      hecomClienteId: input.hecomClienteId,
    });
    if (hecomBucket && HECOM_BM_BUCKET_TO_BC[hecomBucket]) {
      return {
        bcId: HECOM_BM_BUCKET_TO_BC[hecomBucket]!,
        bmBucket: hecomBucket,
        source: "hecom",
      };
    }

    const probed = await probeAgencyBcForAdvertiser({
      advertiserId,
      organizationId: input.organizationId,
    });
    if (probed) return probed;
  }

  const fallback = resolveBcIdForHecomBucket(
    raw || null,
    raw || serverEnv.tiktokDefaultBcId.trim() || null,
  );
  return {
    bcId: fallback,
    bmBucket: resolveBmBucketFromBcId(fallback),
    source: "default",
  };
}
