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
    payment_portfolios?: Array<Record<string, unknown>>;
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

  // TikTok v1.3: `payment_portfolios` (no `list`). Mantener ambos por compat.
  const rows = json.data?.payment_portfolios ?? json.data?.list ?? [];

  return rows
    .map((row) => {
      const alloc = row.credit_line_allocation as
        | Record<string, unknown>
        | undefined;
      // IDs como string: Number() pierde precisión en snowflakes TikTok.
      const idRaw = row.payment_portfolio_id;
      const paymentPortfolioId =
        typeof idRaw === "string"
          ? idRaw.trim()
          : idRaw != null
            ? String(idRaw)
            : "";
      const cashList = Array.isArray(row.cash_balance_list)
        ? (row.cash_balance_list as Array<Record<string, unknown>>)
        : [];
      const cashUsd = cashList.reduce((sum, item) => {
        const n = Number(item.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      return {
        paymentPortfolioId,
        name: row.payment_portfolio_name
          ? String(row.payment_portfolio_name)
          : null,
        type: row.payment_portfolio_type
          ? String(row.payment_portfolio_type)
          : null,
        bcId: row.bc_id ? String(row.bc_id) : null,
        availableCredit: num(alloc?.available_amount) ?? (cashUsd > 0 ? cashUsd : null),
        totalCredit: num(alloc?.total_amount),
        usedCredit: num(alloc?.used_amount),
      };
    })
    .filter((row) => Boolean(row.paymentPortfolioId));
}

/**
 * Resuelve el Payment Portfolio del BC (BM200 multi-PA exige este id en
 * `/bc/balance/get/` y `/bc/transfer/`).
 * Preferí string exacto de `/payment_portfolio/get/` — nunca Number().
 */
export async function resolveBcPaymentPortfolioId(input: {
  bcId: string;
  organizationId?: string;
}): Promise<string | null> {
  const portfolios = await listPaymentPortfoliosForBc(input);
  if (portfolios.length === 0) return null;
  if (portfolios.length === 1) return portfolios[0].paymentPortfolioId;

  // Si hay varios, preferí NON_SHARED con cash/crédito visible; si no, el primero.
  const withFunds = portfolios.find(
    (p) => (p.availableCredit ?? 0) > 0 || p.type === "NON_SHARED",
  );
  return (withFunds ?? portfolios[0]).paymentPortfolioId;
}
