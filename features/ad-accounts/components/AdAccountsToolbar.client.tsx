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
];

interface AdAccountsToolbarProps {
  initialSearch?: string;
  initialStatus?: string;
}

export function AdAccountsToolbar({
  initialSearch = "",
  initialStatus = "all",
}: AdAccountsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
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
      <div className="border-b border-[#e5e7eb] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
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
                placeholder="Buscar por ID, nombre o estado"
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
              className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm text-[#0f172a] focus:border-[#4056ff] focus:outline-none focus:ring-2 focus:ring-[#4056ff]/20 sm:w-auto"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={routes.creativeAnalyzer} className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-[#dbe1ea] sm:w-auto"
              >
                Analizador creativo
              </Button>
            </Link>
            <Button
              onClick={dispatchAdAccountsOpenCreateModal}
              className="h-11 w-full rounded-xl bg-[#4056ff] shadow-sm hover:bg-[#4056ff]/90 sm:w-auto"
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
