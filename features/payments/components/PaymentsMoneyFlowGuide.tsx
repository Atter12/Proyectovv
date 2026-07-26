import Link from "next/link";
import { routes } from "@/config/routes";

const STEPS = [
  {
    n: "1",
    title: "Recargar",
    text: "Metés plata a la cartera Holistic (Stripe).",
  },
  {
    n: "2",
    title: "Asignar",
    text: "Pasás ese saldo a una cuenta TikTok.",
  },
  {
    n: "3",
    title: "Gastar",
    text: "Las campañas consumen de esa cuenta.",
  },
] as const;

/** Mini guía visual del flujo real de dinero (wallet → cuenta ads). */
export function PaymentsMoneyFlowGuide() {
  return (
    <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#faf7f3] px-4 py-3.5 sm:px-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8a5a38]">
        Cómo funciona la plata
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.n} className="relative flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e85a1c] text-[11px] font-medium text-white">
              {step.n}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#1a1612]">{step.title}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-[#6b645c]">
                {step.text}
              </p>
            </div>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="absolute -right-1.5 top-3 hidden text-[#c4bbb0] sm:block"
              >
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-[#7a736a]">
        No se paga campaña por campaña. Primero cartera, después{" "}
        <a
          href="#asignar-saldo"
          className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
        >
          asignar a cuenta
        </a>
        {" · "}
        <Link
          href={routes.adAccounts}
          className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
        >
          ver cuentas
        </Link>
        .
      </p>
    </div>
  );
}
