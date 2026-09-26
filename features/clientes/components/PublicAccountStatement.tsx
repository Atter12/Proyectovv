import type { ReactNode } from "react";
import type { CobranzaMonthSnapshot } from "@/lib/hecom/cobranza-month-snapshot";

type PublicPayment = {
  id: string;
  fecha: string | null;
  codigo: string | null;
  monto: number;
  applicableMonto?: number;
  metodo: string | null;
};

function money(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

function dateLabel(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Public presentation only. Amounts come from the existing monthly snapshot. */
export function PublicAccountStatement({
  snapshot,
  payments,
  expenses,
  capped,
  children,
}: {
  snapshot: CobranzaMonthSnapshot;
  payments: PublicPayment[];
  expenses: { fecha: string; gasto: number; cuenta: string }[];
  capped: boolean;
  children: ReactNode;
}) {
  const hasDebt = snapshot.deudaCorte > 0;
  const credit = Math.max(0, snapshot.rangeSaldo);
  const hasMovements = expenses.length > 0 || payments.length > 0;
  const balance = money(hasDebt ? snapshot.deudaCorte : credit);
  const spendDays = snapshot.series.filter((day) => day.key <= snapshot.spendTo);

  return (
    <div className="space-y-8 text-[var(--admin-text)]">
      {capped ? (
        <p role="status" className="rounded-xl bg-[var(--admin-badge-warning-bg)] p-4 text-sm leading-6 text-[var(--admin-badge-warning-text)]">
          Este estado puede no incluir todos los movimientos. Confirma el saldo con tu equipo de atención antes de pagar.
        </p>
      ) : null}

      <section aria-labelledby="account-balance" className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_0.85fr] lg:gap-12">
          <div className="min-w-0">
            <h2 id="account-balance" className="text-base font-medium text-[var(--admin-text-muted)]">
              {hasDebt ? "Saldo pendiente" : credit > 0 ? "Saldo a favor del mes" : "Sin saldo pendiente"}
            </h2>
            <p className={`mt-2 flex flex-wrap items-baseline gap-x-3 font-semibold tracking-tight tabular-nums ${balance.length > 14 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"}`}>
              <span className="max-w-full [overflow-wrap:anywhere]">{balance}</span>
              <span className="text-base font-medium tracking-normal text-[var(--admin-text-muted)]">USD</span>
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--admin-text-muted)]">
              {hasDebt
                ? "Tu inversión en anuncios y la comisión del servicio, menos los pagos aplicados."
                : credit > 0
                  ? "Los pagos aplicados superan los cargos de este mes. Puedes revisar el detalle más abajo."
                  : hasMovements ? "Los cargos registrados de este mes están cubiertos." : "Sin movimientos registrados en este mes."}
            </p>
            <p className="mt-4 text-sm text-[var(--admin-text-muted)]">
              Gastos incluidos hasta el <span className="font-medium text-[var(--admin-text)]">{dateLabel(snapshot.spendTo)}</span>.
            </p>
          </div>
          {children}
        </div>

        <dl className="grid border-t border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-5 sm:grid-cols-3 sm:px-8">
          {[
            ["Inversión en anuncios", snapshot.gasto],
            ["Comisión del servicio", snapshot.fee],
            ["Pagos aplicados", snapshot.cobrado],
          ].map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] py-4 last:border-b-0 sm:block sm:border-b-0 sm:py-5">
              <dt className="text-sm text-[var(--admin-text-muted)]">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums sm:mt-1">{money(Number(amount))}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="payment-history" aria-labelledby="payment-history-title" className="scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="payment-history-title" className="text-xl font-semibold tracking-tight">Tus pagos del mes</h2>
          <p className="text-sm text-[var(--admin-text-muted)]">{payments.length} {payments.length === 1 ? "pago registrado" : "pagos registrados"} · USD</p>
        </div>
        {payments.length > 0 ? (
          <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {payments.map((payment) => {
              const applied = payment.applicableMonto ?? payment.monto;
              const hasProviderCharge = Math.abs(payment.monto - applied) >= 0.01;
              return (
                <li key={payment.id} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{payment.metodo || "Pago registrado"}</p>
                    <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{dateLabel(payment.fecha)}</p>
                    {payment.codigo ? <p className="mt-1 break-all text-xs leading-5 text-[var(--admin-text-muted)]">Referencia: {payment.codigo}</p> : null}
                  </div>
                  <div className="ml-auto max-w-full text-right">
                    <p className="font-semibold tabular-nums">{money(applied)}</p>
                    <p className="mt-1 text-sm text-[var(--admin-badge-success-text)]">Aplicado a este mes</p>
                    {hasProviderCharge ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">Total transferido: {money(payment.monto)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--admin-border-strong)] p-5 text-sm leading-6 text-[var(--admin-text-muted)]">
            Aún no hay pagos aplicados a este mes. Si ya transferiste, utiliza «Ya pagué y no aparece» para enviar tu comprobante.
          </p>
        )}
        {snapshot.surcharge > 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--admin-text-muted)]">
            Los pagos incluyen {money(snapshot.surcharge)} USD en cargos de procesamiento. Esos cargos no reducen el saldo pendiente.
          </p>
        ) : null}
      </section>

      <details className="group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <summary className="cursor-pointer rounded-xl px-5 py-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--admin-accent)] sm:text-lg">
          Detalle diario de inversión
          <span className="mt-1 block pl-4 text-sm font-normal text-[var(--admin-text-muted)]">Consulta los anuncios y la comisión de cada día.</span>
        </summary>
        <div className="border-t border-[var(--admin-border)] px-3 pb-4 sm:px-5">
          <p className="py-4 text-sm text-[var(--admin-text-muted)] sm:hidden">Importes en USD. Total del período: {money(snapshot.cargo)}.</p>
          <ul className="divide-y divide-[var(--admin-border)] sm:hidden">
            {spendDays.map((day) => (
              <li key={day.key} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <time dateTime={day.key} className="text-sm font-medium">{dateLabel(day.key)}</time>
                  <span className="font-semibold tabular-nums">{money(day.cargo)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[var(--admin-text-muted)]">Anuncios</dt><dd className="mt-1 tabular-nums">{money(day.gasto)}</dd></div>
                  <div className="text-right"><dt className="text-[var(--admin-text-muted)]">Comisión</dt><dd className="mt-1 tabular-nums">{money(day.fee)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-right text-sm tabular-nums sm:table">
            <caption className="py-4 text-left text-sm text-[var(--admin-text-muted)]">Importes en USD. Total del período: {money(snapshot.cargo)}.</caption>
            <thead className="text-xs text-[var(--admin-text-muted)] sm:text-sm">
              <tr className="border-b border-[var(--admin-border)]">
                <th scope="col" className="py-3 text-left font-medium">Día</th>
                <th scope="col" className="py-3 font-medium">Anuncios</th>
                <th scope="col" className="py-3 font-medium">Comisión</th>
                <th scope="col" className="py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {spendDays.map((day) => (
                <tr key={day.key} className="hover:bg-[var(--admin-surface-soft)]">
                  <th scope="row" className="py-3 text-left font-normal"><time dateTime={day.key}>{Number(day.key.slice(8))}</time></th>
                  <td className="py-3">{money(day.gasto)}</td>
                  <td className="py-3">{money(day.fee)}</td>
                  <td className="py-3 font-medium">{money(day.cargo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-5 text-[var(--admin-text-muted)]">Los totales se calculan antes de redondear. La suma de los importes diarios mostrados puede variar unos centavos.</p>
        </div>
      </details>

      {expenses.length > 0 ? (
        <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <summary className="cursor-pointer rounded-xl px-5 py-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--admin-accent)]">
            Movimientos por cuenta publicitaria
          </summary>
          <ul className="border-t border-[var(--admin-border)] px-5">
            {expenses.map((expense, index) => (
              <li key={`${expense.fecha}-${index}`} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] py-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{expense.cuenta}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{dateLabel(expense.fecha)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{money(expense.gasto)}</p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)]">Anuncios · USD</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
        Este estado corresponde al mes indicado. Un pago realizado en otra fecha puede aparecer aquí si fue aplicado a este período.
      </p>
    </div>
  );
}
