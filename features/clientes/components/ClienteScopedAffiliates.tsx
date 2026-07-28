import Link from "next/link";
import { routes } from "@/config/routes";
import { ClienteScopePageHeader } from "@/features/clientes/components/ClienteScopePageChrome";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  return (
    <div className="space-y-5">
      <ClienteScopePageHeader
        eyebrow="Afiliados · opcional"
        title="Programa de afiliados"
        description={`Si aplica para ${data.cliente.name}. No es el core de ads ni de pagos.`}
        name={data.cliente.name}
        avatarUrl={data.cliente.avatarUrl}
      />

      <section className="overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
        <div className="border-b border-[rgb(20_18_16_/_0.07)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              Sin afiliados por cliente en Hecom
            </h2>
            <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]">
              Agencia
            </span>
            <span className="rounded bg-[#fff1e8] px-1.5 py-0.5 text-[10px] font-semibold text-[#c45a18]">
              No por cliente
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[#7a736a]">
            El programa es de la org — no hay referrals por cliente en Hecom Club
          </p>
        </div>

        <div className="px-5 py-5">
          <p className="text-[13px] leading-6 text-[#6b645c]">
            Por eso acá no se mezclan datos de otros clientes ni de la org
            genérica. Seguís viendo solo el contexto de{" "}
            <span className="font-semibold text-[#1a1612]">
              {data.cliente.name}
            </span>
            .
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={routes.payments}
              className="rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#c45a18] transition-colors hover:bg-[#faf7f3]"
            >
              Pagos
            </Link>
            <Link
              href={routes.adAccounts}
              className="rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#c45a18] transition-colors hover:bg-[#faf7f3]"
            >
              Cuentas
            </Link>
            <Link
              href={routes.creativeAnalyzer}
              className="rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#c45a18] transition-colors hover:bg-[#faf7f3]"
            >
              Creativos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
