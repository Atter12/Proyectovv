import { formatMoney } from "@/lib/format-money";
import { WalletSummaryActions } from "./WalletSummaryActions.client";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import type { PaymentGateway, WalletOverview } from "@/types/payment";

interface WalletSummaryPremiumProps {
  wallet: WalletOverview;
  preferredGateway: PaymentGateway;
  /** Gerentes fondean por BM; la cartera Holistic es solo camino cliente. */
  staffMode?: boolean;
  /** Super admin / cliente: pueden abrir Stripe. Gerentes normales no. */
  canClientStripeFund?: boolean;
  /** Saldo CRM del cliente operativo (gerente = bloque principal). */
  hecomFinance?: HecomFinanceSnapshot | null;
  clienteName?: string;
}

/**
 * Gerente BM: bloque de operación Hecom (saldo estimado real).
 * Cliente / SA Stripe: cartera Holistic.
 */
export function WalletSummaryPremium({
  wallet,
  preferredGateway,
  staffMode = false,
  canClientStripeFund = true,
  hecomFinance = null,
  clienteName,
}: WalletSummaryPremiumProps) {
  const gerenteBmOnly = staffMode && !canClientStripeFund;
  const showHecomLead =
    gerenteBmOnly && hecomFinance != null;
  const debt =
    hecomFinance != null && hecomFinance.saldoEstimado < 0;

  if (showHecomLead) {
    return (
      <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_8px_24px_-18px_rgb(28_25_23_/_0.14)]">
        <div
          aria-hidden
          className="h-0.5 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
        />

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#ff781f]">
                Operación Hecom
              </p>
              {clienteName ? (
                <p className="text-[12px] font-medium text-[#5c564e]">
                  {clienteName}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9a9187]">
                  {debt ? "Deuda neta" : "Saldo estimado"}
                </p>
                <p
                  className={`mt-0.5 text-[1.35rem] font-bold leading-none tracking-[-0.03em] tabular-nums ${
                    debt ? "text-[#b45309]" : "text-[#1c1917]"
                  }`}
                >
                  {formatMoney(hecomFinance.saldoEstimado, "USD")}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6b645c]">
                <span>
                  Cobros{" "}
                  <span className="font-semibold tabular-nums text-[#1c1917]">
                    {formatMoney(hecomFinance.cobroTotal, "USD")}
                  </span>
                </span>
                <span>
                  Gastos{" "}
                  <span className="font-semibold tabular-nums text-[#1c1917]">
                    {formatMoney(hecomFinance.gastoTotal, "USD")}
                  </span>
                </span>
                <span>
                  Fee{" "}
                  <span className="font-semibold text-[#ff781f]">
                    {hecomFinance.depositFeePercent}%
                  </span>
                </span>
              </div>
            </div>
            <p className="mt-2 max-w-xl text-[11px] leading-4 text-[#9a9187]">
              Recargar BM no baja deuda Hecom. Abajo ves crédito TikTok en vivo y
              ledger Holistic por cuenta.
            </p>
          </div>

          <a
            href="#asignar-saldo"
            className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
          >
            Ir a recargar BM
          </a>
        </div>
      </section>
    );
  }

  const subtitle =
    staffMode && !canClientStripeFund
      ? "Modo gerente: recargá desde BM (sin Stripe)"
      : staffMode
        ? "Super admin: Stripe o BM según el camino elegido"
        : "Listo para asignar a cuentas TikTok";

  return (
    <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_12px_32px_-20px_rgb(28_25_23_/_0.18)]">
      <div
        aria-hidden
        className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
      />

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
            Cartera Holistic
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#5c564e]">
            {subtitle}
          </p>
          {hecomFinance != null && staffMode ? (
            <p className="mt-1 text-[12px] text-[#8a8177]">
              {debt ? "Deuda neta" : "Saldo estimado"} Hecom:{" "}
              <span
                className={`font-semibold tabular-nums ${
                  debt ? "text-[#b45309]" : "text-[#1c1917]"
                }`}
              >
                {formatMoney(hecomFinance.saldoEstimado, "USD")}
              </span>
              {clienteName ? ` · ${clienteName}` : ""}
            </p>
          ) : (
            <p className="mt-1 truncate text-[12px] text-[#8a8177]">
              {wallet.name}
            </p>
          )}
          <p className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#1c1917] sm:text-[2.35rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          {hecomFinance != null ? (
            <div className="mt-3 rounded-xl border border-[#ff781f]/35 bg-[#fff1e8] px-3.5 py-2.5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#ff781f]">
                Fee Holistic · Hecom Club
              </p>
              <p className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917]">
                {hecomFinance.depositFeePercent}%
              </p>
              <p className="mt-1 text-[12px] leading-4 text-[#5c564e]">
                Ponés lo que querés en cartera; se cobra ese monto + fee. Con fee{" "}
                {hecomFinance.depositFeePercent}%: si querés $100 se cobran $
                {(100 * (1 + hecomFinance.depositFeePercent / 100)).toFixed(0)}.
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5c564e]">
            <span>
              Última recarga:{" "}
              <span className="font-semibold text-[#1c1917]">
                {wallet.lastTopUp ?? "Sin registros"}
              </span>
            </span>
            <span>
              Método:{" "}
              <span className="font-semibold text-[#1c1917]">
                {preferredGateway.name}
              </span>
            </span>
          </div>
        </div>

        {canClientStripeFund ? (
          <WalletSummaryActions
            availableBalance={wallet.balance}
            currency={wallet.currency}
          />
        ) : (
          <a
            href="#asignar-saldo"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
          >
            Ir a recargar BM
          </a>
        )}
      </div>
    </section>
  );
}
