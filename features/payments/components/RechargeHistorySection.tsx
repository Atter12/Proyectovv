import { getRechargeHistory } from "@/lib/payments/recharge-history.server";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";

/**
 * Historial de recargas de la cartera.
 *
 * Antes esto no existía en la interfaz: el componente de pestañas estaba
 * escrito pero no montado en ningún lado, así que el cliente no tenía forma de
 * ver sus propias recargas.
 */

const ESTADO_ETIQUETA: Record<string, { texto: string; clase: string }> = {
  acreditada: {
    texto: "Acreditada",
    clase: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  en_revision: {
    texto: "En revisión",
    clase: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  esperando_pago: {
    texto: "Esperando pago",
    clase: "bg-slate-100 text-slate-600 ring-slate-500/20",
  },
  cancelada: {
    texto: "Cancelada",
    clase: "bg-slate-100 text-slate-500 ring-slate-400/20",
  },
};

const APROBADO_POR: Record<string, string> = {
  banco: "Confirmada por el banco",
  comprobante: "Aprobada por comprobante",
  equipo: "Aprobada por el equipo",
};

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(iso));
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function RechargeHistorySection({
  organizationId,
}: {
  organizationId: string;
}) {
  const recargas = await getRechargeHistory(organizationId);

  return (
    <section className="rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ff781f]">
        Cartera Holistic
      </p>
      <h2 className="mt-1 text-lg font-bold text-[#1c1917]">
        Historial de recargas
      </h2>
      <p className="mt-1 text-sm text-[#5c564e]">
        Cada fila es una recarga a tu cartera: cuánto pagaste, cuánto entró y
        cómo se confirmó.
      </p>

      {recargas.length === 0 ? (
        <p className="mt-5 rounded-xl bg-[#faf8f5] px-4 py-6 text-center text-sm text-[#8a8177]">
          Todavía no registraste recargas.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-[#ece7e0] text-left text-[11px] uppercase tracking-wide text-[#8a8177]">
                <th className="pb-2 pr-3 font-semibold">Fecha</th>
                <th className="pb-2 pr-3 font-semibold">Método</th>
                <th className="pb-2 pr-3 font-semibold">Pagaste</th>
                <th className="pb-2 pr-3 font-semibold">A tu cartera</th>
                <th className="pb-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recargas.map((recarga) => {
                const estado =
                  ESTADO_ETIQUETA[recarga.status] ??
                  ESTADO_ETIQUETA.esperando_pago;

                return (
                  <tr
                    key={recarga.id}
                    className="border-b border-[#f4f0ea] last:border-0"
                  >
                    <td className="py-3 pr-3 text-[#5c564e]">
                      {formatFecha(recarga.date)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-[#1c1917]">
                        {recarga.method}
                      </span>
                      {recarga.operationNumber ? (
                        <span className="block text-[11px] text-[#8a8177]">
                          Op. {recarga.operationNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-medium text-[#1c1917]">
                      {recarga.grossCurrency === "PEN"
                        ? formatPenAmount(recarga.grossAmount)
                        : formatUsd(recarga.grossAmount)}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-[#1c1917]">
                      {formatUsd(recarga.creditUsdCents)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${estado.clase}`}
                      >
                        {estado.texto}
                      </span>
                      {recarga.approvedBy ? (
                        <span className="block text-[11px] text-[#8a8177]">
                          {APROBADO_POR[recarga.approvedBy]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
