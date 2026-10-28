"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { depositFromDesiredCredit } from "@/lib/payments/deposit-fee";

type CardConfig = { enabled: boolean; surchargePercent: number };
type CardProvider = "stripe" | "whop";

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Pago de deuda con tarjeta desde el link Lo pagado. Baja la deuda del mes, no recarga cartera.
 * Stripe si está activo; si no, Whop.
 */
export function PublicDebtCardPay({
  configUrl,
  apiBase,
  month,
  owedUsd,
}: {
  configUrl: string;
  /** Base de la API pública; se le agrega /stripe o /whop. */
  apiBase: string;
  month: string;
  /** Deuda del mes (positivo = debe). */
  owedUsd: number;
}) {
  const searchParams = useSearchParams();
  const returned = searchParams.get("pago") === "tarjeta";
  const [config, setConfig] = useState<(CardConfig & { provider: CardProvider }) | null>(null);
  const owedCents = Math.max(0, Math.round(owedUsd * 100));
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(configUrl)
      .then((r) => r.json())
      .then((j: { whop?: CardConfig; stripe?: CardConfig }) => {
        if (!alive) return;
        if (j.stripe?.enabled) setConfig({ ...j.stripe, provider: "stripe" });
        else setConfig({ ...(j.whop ?? { enabled: false, surchargePercent: 0 }), provider: "whop" });
      })
      .catch(() => {
        if (alive) setConfig({ enabled: false, surchargePercent: 0, provider: "whop" });
      });
    return () => {
      alive = false;
    };
  }, [configUrl]);

  if (!config?.enabled) return null;

  const debtCents = partial ? Math.round(Number(amount) * 100) : owedCents;
  const valid = Number.isFinite(debtCents) && debtCents >= 100 && debtCents <= 5_000_000;
  const quote = valid ? depositFromDesiredCredit(debtCents, config.surchargePercent) : null;

  const monthLabel = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`),
  );

  async function pay() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${config!.provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: debtCents / 100, periodoResumen: month }),
      });
      const j = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !j.checkoutUrl) throw new Error(j.error || "No se pudo abrir el pago con tarjeta.");
      window.location.href = j.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el pago con tarjeta.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-[#e8dfd4] sm:p-6">
      {returned ? (
        <p className="mb-4 rounded-2xl bg-[#ecfdf3] px-4 py-3 text-[13px] leading-5 text-[#05603a] ring-1 ring-[#abefc6]">
          Recibimos tu pago con tarjeta. En unos minutos aparece abajo en tus pagos y baja lo que debes del mes.
        </p>
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">Pagos</p>
      <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-[#1a1714] sm:text-[1.5rem]">
        Pagar con tarjeta
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#3f3a34]">
        Con tarjeta de crédito o débito, sin subir voucher. Se registra al instante en {monthLabel} y no recarga
        cartera. La tarjeta tiene un recargo de {config.surchargePercent}%.
      </p>

      {owedCents > 0 ? (
        <div className="mt-4 rounded-2xl bg-[#faf8f5] px-4 py-3 ring-1 ring-[#e8dfd4]">
          <p className="text-[12px] font-semibold text-[#5c564e]">Debes en {monthLabel}</p>
          <p className="text-[1.6rem] font-semibold tracking-[-0.03em] text-[#1a1714]">{usd(owedCents)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-[#ecfdf3] px-4 py-3 text-[13px] text-[#05603a] ring-1 ring-[#abefc6]">
          No tienes deuda en {monthLabel}. Si igual quieres abonar, usa “Abonar otro monto”.
        </p>
      )}

      {partial ? (
        <label className="mt-4 block w-full sm:max-w-[14rem]">
          <span className="text-[12px] font-semibold text-[#5c564e]">Monto a abonar (USD)</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="mt-1 h-11 w-full rounded-xl bg-white px-3 text-[15px] font-semibold text-[#1a1714] ring-1 ring-[#e8dfd4] outline-none focus:ring-2 focus:ring-[#d47840]"
          />
        </label>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={pay}
          disabled={!valid || busy}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#1a1714] px-5 text-[13px] font-semibold text-white transition hover:bg-[#3f3a34] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Abriendo pago…"
            : partial
              ? quote
                ? `Abonar ${usd(quote.creditCents)} (pagas ${usd(quote.grossCents)})`
                : "Abonar con tarjeta"
              : quote
                ? `Pagar todo · ${usd(quote.grossCents)}`
                : "Pagar todo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPartial((v) => !v);
            setAmount("");
            setError(null);
          }}
          className="inline-flex h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-[#c2410c] ring-1 ring-[#ffd7b8] transition hover:bg-[#fff8f1]"
        >
          {partial ? (owedCents > 0 ? "Mejor pagar todo" : "Cancelar") : "Abonar otro monto"}
        </button>
      </div>
      {quote ? (
        <p className="mt-2 text-[12px] text-[#6b645c]">
          Deuda {usd(quote.creditCents)} + recargo tarjeta {usd(quote.feeCents)} = {usd(quote.grossCents)}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] font-medium text-[#b42318]">{error}</p> : null}
    </section>
  );
}
