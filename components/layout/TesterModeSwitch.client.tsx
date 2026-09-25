"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { TesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";

export function TesterModeSwitch({ mode }: { mode: TesterDashboardMode }) {
  const t = useTranslations("nav.modeSwitch");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: TesterDashboardMode) {
    if (next === mode || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/session/dashboard-mode", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? t("error"));
          return;
        }
        router.refresh();
      } catch {
        setError(t("error"));
      }
    });
  }

  return (
    <div className="mt-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-muted)]">
        {t("label")}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--auth-bg)] p-1">
        <ModeButton
          active={mode === "cliente"}
          disabled={pending}
          label={t("cliente")}
          onClick={() => choose("cliente")}
        />
        <ModeButton
          active={mode === "gerente"}
          disabled={pending}
          label={t("gerente")}
          onClick={() => choose("gerente")}
        />
      </div>
      {error ? <p className="mt-2 text-[11px] leading-4 text-rose-700">{error}</p> : null}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        active
          ? "h-9 rounded-lg bg-white text-[12px] font-semibold text-[var(--auth-text)] shadow-sm"
          : "h-9 rounded-lg text-[12px] font-semibold text-[var(--auth-text-muted)] hover:text-[var(--auth-text)] disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
