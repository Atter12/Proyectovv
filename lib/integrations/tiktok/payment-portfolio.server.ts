import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PaymentPortfolioRow {
  paymentPortfolioId: string;
  name: string | null;
  type: string | null;
  bcId: string | null;
  availableCredit: number | null;
  totalCredit: number | null;
  usedCredit: number | null;
}

/**
 * Lista Payment Portfolios accesibles para un BC (cuando TikTok los expone).
 */
export async function listPaymentPortfoliosForBc(input: {
  bcId: string;
  organizationId?: string;
}): Promise<PaymentPortfolioRow[]> {
  const { token: accessToken } = await resolveTikTokFinanceAccessToken(
    input.organizationId,
  );
  const url = new URL(apiUrl("/payment_portfolio/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "50");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<Record<string, unknown>>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn("[tiktok-portfolio] get_failed", {
      bcId: input.bcId,
      code: json.code ?? null,
      message: json.message ?? null,
    });
    return [];
  }

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return (json.data?.list ?? []).map((row) => {
    const alloc = row.credit_line_allocation as Record<string, unknown> | undefined;
    return {
      paymentPortfolioId: String(row.payment_portfolio_id ?? ""),
      name: row.payment_portfolio_name ? String(row.payment_portfolio_name) : null,
      type: row.payment_portfolio_type ? String(row.payment_portfolio_type) : null,
      bcId: row.bc_id ? String(row.bc_id) : null,
      availableCredit: num(alloc?.available_amount),
      totalCredit: num(alloc?.total_amount),
      usedCredit: num(alloc?.used_amount),
    };
  });
}
