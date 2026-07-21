"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/config/routes";
import {
  AD_ACCOUNTS_OPEN_CREATE_MODAL,
  dispatchAdAccountsOpenCreateModal,
} from "@/lib/events/modal-events";
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
}

export function AdAccountsToolbar({
  initialSearch = "",
  initialStatus = "all",
  initialIncludeArchived = false,
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
      <div className="border-b border-[var(--border-subtle)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"
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
                placeholder="Buscar por ID, nombre, plataforma o estado"
                value={search}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearch(value);
                  updateParams({ q: value || null });
                }}
                className="h-11 w-full pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                const value = e.target.value;
                setStatus(value);
                updateParams({ status: value === "all" ? null : value });
              }}
              className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 text-sm text-[var(--foreground)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 sm:w-auto"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-3 text-sm font-medium text-[var(--admin-text-muted,#64748b)]">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIncludeArchived(checked);
                  updateParams({ archived: checked ? "1" : null });
                }}
                className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
              />
              Ver archivadas
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/api/integrations/tiktok/connect" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-[var(--border-subtle)] sm:w-auto"
              >
                Conectar TikTok
              </Button>
            </a>
            <Link href={routes.creativeAnalyzer} className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-[var(--border-subtle)] sm:w-auto"
              >
                Analizador creativo
              </Button>
            </Link>
            <Button
              onClick={dispatchAdAccountsOpenCreateModal}
              className="h-11 w-full rounded-xl bg-[var(--brand-primary)] shadow-sm hover:bg-[var(--brand-primary-deep)] sm:w-auto"
            >
              Crear nuevo
            </Button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <CreateAdAccountModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
