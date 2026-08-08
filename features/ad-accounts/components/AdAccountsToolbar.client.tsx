"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/config/routes";
import { AD_ACCOUNTS_OPEN_CREATE_MODAL } from "@/lib/events/modal-events";
import type { AdAccountStatus } from "@/types/ad-account";

const CreateAdAccountModal = dynamic(
  () =>
    import("./CreateAdAccountModal.client").then((m) => m.CreateAdAccountModal),
  { ssr: false },
);

const statusOptions: { value: AdAccountStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activa" },
  { value: "pending", label: "Pendiente" },
  { value: "disabled", label: "Desactivada" },
  { value: "review", label: "En revisión" },
  { value: "archived", label: "Archivada" },
];

interface AdAccountsToolbarProps {
  initialSearch?: string;
  initialStatus?: string;
  initialIncludeArchived?: boolean;
  hideCreate?: boolean;
}

export function AdAccountsToolbar({
  initialSearch = "",
  initialStatus = "all",
  initialIncludeArchived = false,
  hideCreate = false,
}: AdAccountsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [includeArchived, setIncludeArchived] = useState(initialIncludeArchived);
  const [modalOpen, setModalOpen] = useState(false);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    function handleOpenModal() {
      setModalOpen(true);
    }
    window.addEventListener(AD_ACCOUNTS_OPEN_CREATE_MODAL, handleOpenModal);
    return () =>
      window.removeEventListener(AD_ACCOUNTS_OPEN_CREATE_MODAL, handleOpenModal);
  }, []);

  return (
    <>
      <div className="border-b border-[var(--auth-border)] bg-[var(--auth-bg)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--auth-text-soft)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <Input
                placeholder="Buscar cuenta o ID"
                value={search}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearch(value);
                  updateParams({ q: value || null });
                }}
                className="h-9 w-full border-[var(--auth-border)] bg-white pl-9 text-[13px] font-normal"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                const value = e.target.value;
                setStatus(value);
                updateParams({ status: value === "all" ? null : value });
              }}
              className="h-9 w-full rounded-lg border border-[var(--auth-border)] bg-white px-3 text-[13px] font-normal text-[var(--auth-text)] focus:border-[var(--auth-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/15 sm:w-auto"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!hideCreate ? (
              <label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--auth-border)] bg-white px-3 text-[12px] font-normal text-[var(--auth-text-muted)]">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIncludeArchived(checked);
                    updateParams({ archived: checked ? "1" : null });
                  }}
                  className="h-3.5 w-3.5 rounded border-[var(--auth-border)] text-[var(--auth-accent)] focus:ring-[var(--auth-accent)]"
                />
                Ver archivadas
              </label>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href={routes.creativeAnalyzer} className="shrink-0">
              <Button
                variant="outline"
                className="h-9 rounded-lg border-[var(--auth-border)] bg-white px-3 text-[12px] font-semibold text-[var(--auth-text)] hover:bg-[var(--auth-bg)]"
              >
                Analizador creativo
              </Button>
            </Link>
            {!hideCreate ? (
              <Button
                onClick={() => setModalOpen(true)}
                className="hidden h-9 rounded-lg bg-[var(--auth-accent)] px-3.5 text-[12px] font-semibold text-white hover:brightness-[1.05] md:inline-flex"
              >
                Crear nuevo
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen && !hideCreate ? (
        <CreateAdAccountModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
