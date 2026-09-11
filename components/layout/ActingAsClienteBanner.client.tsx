"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";

export function ActingAsClienteBanner({
  clienteName,
}: {
  clienteName: string;
}) {
  const t = useTranslations("common.actingAs");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exitToStaff() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actAsCliente: false }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? t("exitError"));
          return;
        }
        router.push(routes.payments);
        router.refresh();
      } catch {
        setError(t("exitError"));
      }
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950 sm:mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-medium leading-5">
          {t("before")}{" "}
          <span className="font-bold">{t("asName", { name: clienteName })}</span>
          {t("after")}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={routes.clientes}
            className="font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t("changeClient")}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={exitToStaff}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-55"
          >
            {pending ? t("exiting") : t("exitStaff")}
          </button>
        </div>
      </div>
      {error ? <p className="mt-1 text-[12px] text-rose-700">{error}</p> : null}
    </div>
  );
}
