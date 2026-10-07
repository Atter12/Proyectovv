import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { serverEnv } from "@/lib/env/env.server";
import { verifyPartnerPanelToken } from "@/lib/partners/partner-panel-token";
import { getPartnerPanelData } from "@/lib/partners/partner-panel.server";
import { CopyLinkButton } from "@/features/partners/components/CopyLinkButton.client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi panel de aliado · Ads Holistic",
  robots: { index: false, follow: false },
};

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" });
const fmtMonth = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("es-PE", { month: "long", year: "numeric", timeZone: "America/Lima" });

/** Panel privado del aliado: sus visitas, sus clientes y lo que lleva ganado. */
export default async function PartnerPanelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const partnerId = verifyPartnerPanelToken(token, serverEnv.holisticWaSnapshotSecret);
  if (!partnerId) notFound();
  const data = await getPartnerPanelData(partnerId);
  if (!data) notFound();

  const landing = `https://www.adsholistic.com/a/${data.partner.slug}`;
  const paying = data.clients.filter((c) => c.payments > 0).length;
  const ratePct = Math.round(data.partner.commissionRate * 1000) / 10;

  return (
    <div className="min-h-dvh bg-[#fcfbf9] text-[#1c1917]">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
        <Image src="/brand/holistic-marketing-logo.png" alt="Holistic Marketing" width={506} height={187} className="h-auto w-[116px]" priority />
        <span className="rounded-full border border-[#efe4d8] bg-white px-3 py-1 text-[12px] font-semibold text-[#5f574f]">Panel de aliado</span>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-5 pb-14">
        <section>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] sm:text-[30px]">Hola, {data.partner.name}</h1>
          <p className="mt-1 text-[14px] text-[#5f574f]">
            Ganas el <strong>{ratePct}% del fee</strong> que Holistic cobra a cada cliente que traes, durante{" "}
            <strong>{data.partner.commissionDays} días</strong> desde que se registra. Se paga una vez al mes.
          </p>
          {data.partner.status === "paused" ? (
            <p className="mt-3 rounded-xl bg-[#fff4ea] px-4 py-3 text-[13px] text-[#765037]">
              Tu landing está pausada por ahora. Escríbenos si quieres reactivarla.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#ece5dc] bg-white p-4 sm:p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">Tu link para compartir</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-all rounded-xl bg-[#faf7f3] px-3 py-2.5 font-mono text-[13px]">{landing}</p>
            <CopyLinkButton text={landing} />
          </div>
          <p className="mt-2 text-[12px] text-[#8a8177]">
            Tip: agrega <span className="font-mono">?utm_source=instagram</span> (o tiktok, whatsapp…) para saber de dónde llegan tus visitas.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Visitas (30 días)", data.visits30d.toLocaleString("es-PE"), `${data.uniqueVisitors30d} personas`],
            ["Registros", data.clients.length.toLocaleString("es-PE"), `${data.visitsTotal} visitas en total`],
            ["Clientes que pagan", paying.toLocaleString("es-PE"), null],
            ["Por cobrar", usd(data.commissionPendingCents), `Cobrado ${usd(data.commissionPaidCents)}`],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-[#ece5dc] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a8177]">{label}</p>
              <p className="mt-1 text-[1.35rem] font-bold tabular-nums tracking-[-0.02em]">{value}</p>
              {hint ? <p className="text-[12px] text-[#8a8177]">{hint}</p> : null}
            </div>
          ))}
        </section>

        {data.topSources.length ? (
          <section className="rounded-2xl border border-[#ece5dc] bg-white p-4 sm:p-5">
            <h2 className="text-[15px] font-bold">De dónde llegan (30 días)</h2>
            <ul className="mt-3 space-y-2">
              {data.topSources.map((s) => (
                <li key={s.source} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 shrink-0 truncate font-semibold capitalize">{s.source}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1ebe4]">
                    <span className="block h-full rounded-full bg-[#ff781f]" style={{ width: `${Math.max(4, (s.visits / data.visits30d) * 100)}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-[#5f574f]">{s.visits}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#ece5dc] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-bold">Tus clientes</h2>
          {data.clients.length === 0 ? (
            <p className="mt-2 text-[13px] text-[#8a8177]">Todavía no se registra nadie con tu link. ¡Compártelo!</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#f1ebe4]">
              {data.clients.map((c, i) => (
                <li key={`${c.displayName}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{c.displayName}</p>
                    <p className="text-[12px] text-[#8a8177]">
                      Desde {fmtDate(c.attributedAt)} · comisión hasta {fmtDate(c.expiresAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    {c.payments > 0 ? (
                      <>
                        <p className="text-[14px] font-bold tabular-nums">{usd(c.commissionCents)}</p>
                        <p className="text-[12px] text-[#8a8177]">{c.payments} recarga{c.payments === 1 ? "" : "s"}</p>
                      </>
                    ) : (
                      <span className="rounded-full bg-[#f1ebe4] px-2.5 py-1 text-[11px] font-semibold text-[#6f675f]">Aún no recarga</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.months.length ? (
          <section className="rounded-2xl border border-[#ece5dc] bg-white p-4 sm:p-5">
            <h2 className="text-[15px] font-bold">Por mes</h2>
            <ul className="mt-3 divide-y divide-[#f1ebe4]">
              {data.months.map((m) => (
                <li key={m.month} className="flex items-center justify-between gap-2 py-2.5 text-[14px]">
                  <span className="capitalize">{fmtMonth(m.month)}</span>
                  <span className="flex items-center gap-2">
                    <strong className="tabular-nums">{usd(m.commissionCents)}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        m.status === "paid" ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#fff4ea] text-[#9a5a1e]"
                      }`}
                    >
                      {m.status === "paid" ? "Pagado" : m.status === "mixed" ? "Parcial" : "Por pagar"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-[12px] text-[#8a8177]">
          Este link es privado: no lo compartas. Las comisiones se actualizan cada hora.
        </p>
      </main>
    </div>
  );
}
