"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { CobranzaDaySeries } from "@/lib/hecom/cobranza-month-snapshot";

type Props = {
  series: CobranzaDaySeries[];
  spendTo: string;
};

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
});
const axisMoney = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Displays the snapshot's daily and cumulative amounts without recomputing them. */
export function PublicDailySpendChart({ series, spendTo }: Props) {
  const id = useId();
  const [activeKey, setActiveKey] = useState("");
  const dayButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const chosenIndex = series.findIndex((day) => day.key === activeKey);
  const defaultIndex = series.reduce(
    (latest, day, index) => day.key <= spendTo ? index : latest,
    0,
  );
  const selectedIndex = chosenIndex >= 0 ? chosenIndex : defaultIndex;
  const selected = chosenIndex >= 0 ? series[chosenIndex] : undefined;
  const total = series.at(-1);
  const afterCutoff = selected ? selected.key > spendTo : false;

  // Only the chart scale is derived here; amounts come directly from the snapshot.
  const minValue = Math.min(0, ...series.flatMap((day) => [day.cargo, day.paid]));
  const maxValue = Math.max(0, ...series.flatMap((day) => [day.cargo, day.paid]));
  const scaleTop = maxValue === minValue ? 1 : maxValue;
  const scaleRange = scaleTop - minValue;
  const zeroPosition = (-minValue / scaleRange) * 100;
  const ticks = [scaleTop, (scaleTop + minValue) / 2, minValue];
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));

  function selectDay(index: number, focus = false) {
    const next = Math.max(0, Math.min(series.length - 1, index));
    if (!series[next]) return;
    setActiveKey(series[next].key);
    if (focus) dayButtons.current[next]?.focus();
  }

  function handleDayKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      setActiveKey("");
      return;
    }
    const next = event.key === "ArrowRight" ? index + 1
      : event.key === "ArrowLeft" ? index - 1
        : event.key === "Home" ? 0
          : event.key === "End" ? series.length - 1
            : null;
    if (next == null) return;
    event.preventDefault();
    selectDay(next, true);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-[var(--admin-text)] sm:p-6">
      <h2 id={`${id}-title`} className="text-xl font-semibold leading-6 tracking-tight">Gasto diario</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-muted)]">
        Gastos hasta el {dateLabel(spendTo)} · USD
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--admin-text-muted)]">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-accent)]" />Anuncios + comisión</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-badge-success-text)]" />Pagos aplicados</span>
      </div>

      {total ? (
        <>
          <p id={`${id}-instructions`} className="sr-only">
            Importes diarios en dólares. Pasa el puntero por una columna o selecciona una fecha para ver sus importes.
            Al retirar el puntero se muestran los totales hasta la fecha.
            En las barras, usa las flechas izquierda y derecha para cambiar de día, Inicio para el primero y Fin para el último.
            Pulsa Escape o elige Total hasta la fecha para volver al resumen.
          </p>
          <div className="mt-4 grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
            <div aria-hidden="true" className="relative h-36 text-right text-[10px] leading-none tabular-nums text-[var(--admin-text-muted)] sm:h-40">
              {ticks.map((value, index) => (
                <span key={index} className="absolute right-0 -translate-y-1/2" style={{ top: `${index * 50}%` }}>
                  {axisMoney.format(value)}
                </span>
              ))}
            </div>
            <div className="relative min-w-0">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 sm:h-40">
                {ticks.map((_, index) => <span key={index} className="absolute inset-x-0 border-t border-[var(--admin-border)]" style={{ top: `${index * 50}%` }} />)}
                {minValue < 0 && maxValue > 0 ? <span className="absolute inset-x-0 border-t border-[var(--admin-border-strong)]" style={{ bottom: `${zeroPosition}%` }} /> : null}
              </div>
              <div role="group" aria-label="Gráfico de importes por día" aria-describedby={`${id}-instructions`} className="relative grid min-w-0" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
                {series.map((day, index) => {
                  const active = index === chosenIndex;
                  const showLabel = index === 0 || index === series.length - 1 || (index % labelEvery === 0 && index < series.length - 2);
                  const dayAmounts = `${day.key > spendTo ? "Gasto pendiente de actualizar" : `Anuncios y comisión: ${money.format(day.cargo)}`}. Pagos aplicados: ${money.format(day.paid)}.`;
                  return (
                    <button
                      key={day.key}
                      ref={(element) => { dayButtons.current[index] = element; }}
                      type="button"
                      tabIndex={index === selectedIndex ? 0 : -1}
                      aria-pressed={active}
                      aria-label={`${dateLabel(day.key)}. ${dayAmounts}`}
                      title={`${dateLabel(day.key)}. ${dayAmounts}`}
                      onClick={() => selectDay(index)}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== "touch") selectDay(index);
                      }}
                      onPointerLeave={(event) => {
                        if (event.pointerType !== "touch") {
                          setActiveKey((current) => current === day.key ? "" : current);
                        }
                      }}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) selectDay(index);
                      }}
                      onKeyDown={(event) => handleDayKey(event, index)}
                      className="group min-w-0 cursor-pointer rounded-sm focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
                    >
                      <span className={`relative flex h-36 justify-center gap-px px-px sm:h-40 sm:gap-0.5 ${active ? "bg-[var(--admin-accent-soft)]" : "group-hover:bg-[var(--admin-surface-hover)]"}`}>
                        {[day.cargo, day.paid].map((amount, barIndex) => {
                          const height = Math.abs(amount) / scaleRange * 100;
                          return (
                            <span key={barIndex} aria-hidden="true" className="relative h-full w-[40%] max-w-3">
                              <span
                                className={`absolute inset-x-0 rounded-t-sm ${barIndex === 0 ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-badge-success-text)]"}`}
                                style={{ height: `${height}%`, bottom: `${amount >= 0 ? zeroPosition : zeroPosition - height}%` }}
                              />
                            </span>
                          );
                        })}
                      </span>
                      <span aria-hidden="true" className={`mt-2 block h-4 text-[10px] leading-4 tabular-nums ${active ? "font-semibold text-[var(--admin-text)]" : "text-[var(--admin-text-muted)]"}`}>
                        {showLabel ? day.label : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <button type="button" aria-label="Día anterior" disabled={chosenIndex === 0} onClick={() => selectDay(chosenIndex >= 0 ? chosenIndex - 1 : defaultIndex)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <label htmlFor={`${id}-date`} className="sr-only">Día del gráfico</label>
            <select id={`${id}-date`} value={selected?.key ?? ""} onChange={(event) => setActiveKey(event.target.value)} className="col-start-2 row-start-1 h-11 min-w-0 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] sm:text-sm">
              <option value="">Total hasta la fecha</option>
              {series.map((day) => <option key={day.key} value={day.key}>{dateLabel(day.key)}</option>)}
            </select>
            <button type="button" aria-label="Día siguiente" disabled={chosenIndex === series.length - 1} onClick={() => selectDay(chosenIndex >= 0 ? chosenIndex + 1 : 0)} className="col-start-3 row-start-1 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div aria-live="polite" aria-atomic="true" className="mt-3 grid min-w-0 grid-cols-2 gap-4">
            <p className="sr-only">{selected ? `Importes del ${dateLabel(selected.key)}` : "Totales hasta la fecha"}</p>
            <div className="min-w-0">
              <p className="text-xs text-[var(--admin-text-muted)]">Anuncios + comisión</p>
              <p className={`mt-1 font-semibold tabular-nums text-[var(--admin-accent-hover)] [overflow-wrap:anywhere] ${afterCutoff ? "text-sm leading-7" : "text-lg leading-7"}`}>{afterCutoff ? "Por actualizar" : money.format(selected ? selected.cargo : total.cargoCum)}</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--admin-text-muted)] [overflow-wrap:anywhere]">{selected ? <>{afterCutoff ? "Acumulado al corte" : "Acumulado"}: <span className="tabular-nums">{money.format(selected.cargoCum)}</span></> : <>Total hasta el {dateLabel(spendTo)}</>}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--admin-text-muted)]">Pagos aplicados</p>
              <p className="mt-1 text-lg font-semibold leading-7 tabular-nums text-[var(--admin-badge-success-text)] [overflow-wrap:anywhere]">{money.format(selected ? selected.paid : total.paidCum)}</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--admin-text-muted)] [overflow-wrap:anywhere]">{selected ? <>Acumulado: <span className="tabular-nums">{money.format(selected.paidCum)}</span></> : <>Total hasta el {dateLabel(total.key)}</>}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="flex min-h-64 items-center justify-center text-center text-sm leading-6 text-[var(--admin-text-muted)]">Aún no hay movimientos diarios para mostrar.</p>
      )}
    </section>
  );
}
